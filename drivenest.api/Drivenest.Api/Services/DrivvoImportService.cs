using Drivenest.Api.Data;
using Drivenest.Api.Data.Entities;
using Drivenest.Api.Dtos.Import;
using Microsoft.EntityFrameworkCore;

namespace Drivenest.Api.Services;

public class DrivvoImportService(AppDbContext db, TimeProvider clock)
{
    private const string Source = "drivvo";
    private const long MaxFileSize = 5 * 1024 * 1024;

    public async Task<DrivvoData> ReadAsync(IFormFile file, CancellationToken cancellationToken)
    {
        if (file.Length > MaxFileSize) throw new FormatException("The file is too large.");

        using var reader = new StreamReader(file.OpenReadStream());
        return DrivvoCsvParser.Parse(await reader.ReadToEndAsync(cancellationToken));
    }

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
            if (row.Liters <= 0 || !refuelingKeys.Add((date, (TimeOnly?)time, row.OdometerKm, row.Liters, row.TotalAmount, row.IsFullTank)))
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
        var oldExpenses = await db.Expenses.AsNoTracking().Where(e => e.VehicleId == vehicleId).ToListAsync(cancellationToken);
        var expenseKeys = new HashSet<(DateOnly Date, int OdometerKm, ExpenseCategory Category, decimal Amount)>();
        foreach (var row in data.Expenses)
        {
            if (row.Type == "")
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

            if ((category.Id > 0 && oldExpenses.Any(e => e.Date == date && e.OdometerKm == row.OdometerKm && e.CategoryId == category.Id && e.Amount == row.Amount))
                || !expenseKeys.Add((date, row.OdometerKm, category, row.Amount)))
            {
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
                Location = Cut(row.Location, 200),
                Description = Cut(row.Notes, 500),
                CreatedAt = now,
                ImportSource = Source
            });
            expenses++;
        }

        // Szervizek: a Drivvo tételenként ír egy sort, az azonos időpontú és óraállású sorok egy szervizhez tartoznak.
        var serviceCategories = await db.ServiceCategories.Where(c => c.UserId == null || c.UserId == userId)
            .OrderBy(c => c.UserId).ToListAsync(cancellationToken);
        var oldServices = await db.ServiceRecords.AsNoTracking().Where(s => s.VehicleId == vehicleId).ToListAsync(cancellationToken);
        foreach (var group in data.Services.Where(s => s.Type != "").GroupBy(s => new { s.Date, s.OdometerKm }))
        {
            var date = DateOnly.FromDateTime(group.Key.Date);
            if (oldServices.Any(s => s.Date == date && s.OdometerKm == group.Key.OdometerKm))
            {
                skipped++;
                continue;
            }

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

            db.ServiceRecords.Add(record);
            services++;
        }

        return new DrivvoImportResultDto(refuelings, expenses, services, skipped);
    }

    private static string? Cut(string? value, int max)
    {
        return value?.Length > max ? value[..max] : value;
    }
}
