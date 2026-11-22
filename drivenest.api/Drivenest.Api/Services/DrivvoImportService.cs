using Drivenest.Api.Data;
using Drivenest.Api.Data.Entities;
using Drivenest.Api.Dtos.Import;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;

namespace Drivenest.Api.Services;

public class DrivvoImportService(AppDbContext db, TimeProvider clock)
{
    private const string Source = "drivvo";
    private const long MaxFileSize = 5 * 1024 * 1024;

    public async Task<DrivvoData> ReadAsync(IFormFile file, CancellationToken cancellationToken)
    {
        if (file.Length > MaxFileSize) throw new FormatException("The file is too large.");

        using var reader = new StreamReader(file.OpenReadStream());
        var data = DrivvoCsvParser.Parse(await reader.ReadToEndAsync(cancellationToken));
        if (data.GetMinOdometerKm() is null)
            throw new FormatException("A Drivvo fájlban nincs importálható tankolás, kiadás vagy szerviz.");
        return data;
    }

    public async Task<DrivvoImportPreviewDto> PreviewAsync(IFormFile file, CancellationToken cancellationToken)
    {
        var data = await ReadAsync(file, cancellationToken);
        var fuelNames = data.Refuelings.SelectMany(row => new[] { row.Fuel, row.SecondFuel, row.ThirdFuel })
            .OfType<string>()
            .Select(NormalizeFuelName)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(2)
            .ToArray();

        int? fuelTypeId = null;
        if (fuelNames.Length == 1)
        {
            var fuelTypes = await db.FuelTypes.Select(fuel => new { fuel.Id, fuel.Name }).ToListAsync(cancellationToken);
            var matches = fuelTypes.Where(fuel => string.Equals(fuel.Name, fuelNames[0], StringComparison.OrdinalIgnoreCase))
                .Take(2).ToArray();
            if (matches.Length == 1) fuelTypeId = matches[0].Id;
        }

        return new DrivvoImportPreviewDto(fuelTypeId, data.GetMinOdometerKm(), data.GetMaxOdometerKm());
    }

    private static string NormalizeFuelName(string name) => name.ToUpperInvariant() switch
    {
        "PETROL" or "GASOLINE" => "Benzin",
        "DIESEL" or "DIZEL" => "Dízel",
        "HYBRID" => "Hibrid",
        _ => name
    };

    public async Task<DrivvoImportResultDto> PrepareAsync(
        int vehicleId, int userId, DrivvoData data, CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var refuelings = 0;
        var expenses = 0;
        var services = 0;
        var skipped = 0;

        var oldRefuelings = await db.Refuelings.AsNoTracking().Where(r => r.VehicleId == vehicleId).ToListAsync(cancellationToken);
        var refuelingKeys = oldRefuelings.Select(r => (
            r.Date,
            Time: r.Time is { } t ? new TimeOnly(t.Hour, t.Minute) : (TimeOnly?)null,
            r.OdometerKm, r.Liters, r.TotalAmount, r.IsFullTank)).ToHashSet();
        foreach (var row in data.Refuelings)
        {
            var date = DateOnly.FromDateTime(row.Date);
            var time = new TimeOnly(row.Date.Hour, row.Date.Minute);
            // Liter nélküli sor (pl. elektromos töltés) és a már meglévő tankolás kimarad.
            if (!row.IsImportable || !refuelingKeys.Add((date, (TimeOnly?)time, row.OdometerKm, row.Liters, row.TotalAmount, row.IsFullTank)))
            {
                skipped++;
                continue;
            }

            db.Refuelings.Add(new Refueling
            {
                VehicleId = vehicleId,
                Date = date,
                Time = time,
                OdometerKm = row.OdometerKm,
                Liters = row.Liters,
                TotalAmount = row.TotalAmount,
                IsFullTank = row.IsFullTank,
                CreatedAt = now,
                ImportSource = Source
            });
            refuelings++;
        }

        // Kiadások: a kategóriát név alapján keressük, ha nincs ilyen, saját kategória lesz belőle.
        var expenseCategories = await db.ExpenseCategories.Where(c => c.UserId == null || c.UserId == userId)
            .OrderBy(c => c.UserId).ToListAsync(cancellationToken);
        var oldExpenses = await db.Expenses.Where(e => e.VehicleId == vehicleId)
            .OrderBy(e => e.Id).ToListAsync(cancellationToken);
        var expenseKeys = oldExpenses.Select(e => e.ImportRecordKey).OfType<string>().ToHashSet();
        var legacyExpenses = oldExpenses.Where(e => e.ImportRecordKey is null).ToList();
        foreach (var row in data.Expenses)
        {
            if (!row.IsImportable)
            {
                skipped++;
                continue;
            }

            var date = DateOnly.FromDateTime(row.Date);
            var name = Cut(row.Type, 100)!;
            var category = expenseCategories.FirstOrDefault(c => string.Equals(c.Name, name, StringComparison.OrdinalIgnoreCase));
            if (category is null)
            {
                category = new ExpenseCategory { Name = name, UserId = userId };
                expenseCategories.Add(category);
            }

            var location = Cut(row.Location, 200);
            var notes = Cut(row.Notes, 500);
            var key = ImportKey(new { row.Date, row.OdometerKm, Category = category.Name.ToUpperInvariant(), Amount = KeyAmount(row.Amount), row.Location, row.Notes });
            if (!expenseKeys.Add(key))
            {
                skipped++;
                continue;
            }

            var legacy = category.Id > 0 ? legacyExpenses.Find(e => e.Date == date && e.OdometerKm == row.OdometerKm
                && e.CategoryId == category.Id && e.Amount == row.Amount && e.Location == location && e.Description == notes) : null;
            if (legacy is not null)
            {
                if (legacy.ImportSource == Source) legacy.ImportRecordKey = key;
                legacyExpenses.Remove(legacy);
                skipped++;
                continue;
            }

            db.Expenses.Add(new Expense
            {
                VehicleId = vehicleId,
                Category = category,
                Date = date,
                OdometerKm = row.OdometerKm,
                Amount = row.Amount,
                Location = location,
                Description = notes,
                CreatedAt = now,
                ImportSource = Source,
                ImportRecordKey = key
            });
            expenses++;
        }

        // Szervizek: a Drivvo tételenként ír egy sort, az azonos időpontú és óraállású sorok egy szervizhez tartoznak.
        var serviceCategories = await db.ServiceCategories.Where(c => c.UserId == null || c.UserId == userId)
            .OrderBy(c => c.UserId).ToListAsync(cancellationToken);
        var oldServices = await db.ServiceRecords.Include(s => s.Items).ThenInclude(i => i.Category)
            .Where(s => s.VehicleId == vehicleId).OrderBy(s => s.Id).ToListAsync(cancellationToken);
        var serviceKeys = oldServices.Select(s => s.ImportRecordKey).OfType<string>().ToHashSet();
        var legacyServices = oldServices.Where(s => s.ImportRecordKey is null).ToList();
        foreach (var group in data.Services.Where(s => s.IsImportable).GroupBy(s => new { s.Date, s.OdometerKm }))
        {
            var date = DateOnly.FromDateTime(group.Key.Date);
            var record = new ServiceRecord
            {
                VehicleId = vehicleId,
                Date = date,
                OdometerKm = group.Key.OdometerKm,
                Provider = Cut(group.First().Location, 150),
                Description = Cut(group.First().Notes, 2000),
                CreatedAt = now,
                ImportSource = Source
            };

            foreach (var row in group)
            {
                var name = Cut(row.Type, 100)!;
                var category = serviceCategories.FirstOrDefault(c => string.Equals(c.Name, name, StringComparison.OrdinalIgnoreCase));
                if (category is null)
                {
                    category = new ServiceCategory { Name = name, UserId = userId };
                    serviceCategories.Add(category);
                }

                // Egy típus csak egyszer lehet egy szervizben, az azonosakat összeadjuk.
                var item = record.Items.FirstOrDefault(i => i.Category == category);
                if (item is null)
                    record.Items.Add(new ServiceRecordItem { Category = category, Amount = row.Amount });
                else
                    item.Amount += row.Amount;
            }

            var items = ServiceItems(record);
            var key = ImportKey(new { group.Key.Date, group.Key.OdometerKm, record.Provider, record.Description,
                Items = items.Select(item => new { item.Category, Amount = KeyAmount(item.Amount) }) });
            if (!serviceKeys.Add(key))
            {
                skipped++;
                continue;
            }

            var legacy = legacyServices.Find(s => s.Date == date && s.OdometerKm == record.OdometerKm
                && s.Provider == record.Provider && s.Description == record.Description && ServiceItems(s).SequenceEqual(items));
            if (legacy is not null)
            {
                if (legacy.ImportSource == Source) legacy.ImportRecordKey = key;
                legacyServices.Remove(legacy);
                skipped++;
                continue;
            }

            record.ImportRecordKey = key;
            db.ServiceRecords.Add(record);
            services++;
        }

        return new DrivvoImportResultDto(refuelings, expenses, services, skipped);
    }

    private static (string Category, decimal Amount)[] ServiceItems(ServiceRecord service) =>
        service.Items.Select(item => (Category: item.Category.Name.ToUpperInvariant(), item.Amount))
            .OrderBy(item => item.Category, StringComparer.Ordinal).ToArray();

    private static string ImportKey<T>(T value) =>
        Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(value)));

    private static string KeyAmount(decimal amount) => amount.ToString("0.00", CultureInfo.InvariantCulture);

    private static string? Cut(string? value, int max)
    {
        return value?.Length > max ? value[..max] : value;
    }
}
