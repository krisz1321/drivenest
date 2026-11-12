using Drivenest.Api.Data;
using Drivenest.Api.Data.Entities;
using Drivenest.Api.Dtos.Import;
using Drivenest.Api.Extensions;
using Drivenest.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Drivenest.Api.Controllers;

// Drivvo CSV export beolvasása egy járműhöz. Az importált bejegyzések ImportSource = "drivvo" jelölést kapnak.
[ApiController]
[Authorize]
[Route("api/vehicles/{vehicleId:int}/import/drivvo")]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
public class DrivvoImportController : ControllerBase
{
    private const string Source = "drivvo";
    private const long MaxFileSize = 5 * 1024 * 1024;

    private readonly AppDbContext _db;
    private readonly TimeProvider _clock;

    public DrivvoImportController(AppDbContext db, TimeProvider clock)
    {
        _db = db;
        _clock = clock;
    }

    [HttpPost]
    [ProducesResponseType(typeof(DrivvoImportResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<DrivvoImportResultDto>> Import(int vehicleId, IFormFile file, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        if (!await _db.Vehicles.AnyAsync(v => v.Id == vehicleId && v.UserId == userId, cancellationToken)) return NotFound();

        if (file.Length > MaxFileSize) return Problem(statusCode: 400, title: "The file is too large.");

        DrivvoData data;
        try
        {
            using var reader = new StreamReader(file.OpenReadStream());
            data = DrivvoCsvParser.Parse(await reader.ReadToEndAsync(cancellationToken));
        }
        catch (FormatException ex)
        {
            return Problem(statusCode: 400, title: ex.Message);
        }

        // Az importálás ideje lesz a CreatedAt.
        var now = _clock.GetUtcNow().UtcDateTime;
        var refuelings = 0;
        var expenses = 0;
        var services = 0;
        var skipped = 0;

        // Tankolások
        var oldRefuelings = await _db.Refuelings.AsNoTracking().Where(r => r.VehicleId == vehicleId).ToListAsync(cancellationToken);
        foreach (var row in data.Refuelings)
        {
            var date = DateOnly.FromDateTime(row.Date);
            // Liter nélküli sor (pl. elektromos töltés) és a már meglévő tankolás kimarad.
            if (row.Liters <= 0 || oldRefuelings.Any(r => r.Date == date && r.OdometerKm == row.OdometerKm && r.Liters == row.Liters))
            {
                skipped++;
                continue;
            }

            _db.Refuelings.Add(new Refueling
            {
                VehicleId = vehicleId,
                Date = date,
                Time = new TimeOnly(row.Date.Hour, row.Date.Minute),
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
        var expenseCategories = await _db.ExpenseCategories.Where(c => c.UserId == null || c.UserId == userId)
            .OrderBy(c => c.UserId).ToListAsync(cancellationToken);
        var oldExpenses = await _db.Expenses.AsNoTracking().Where(e => e.VehicleId == vehicleId).ToListAsync(cancellationToken);
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

            if (oldExpenses.Any(e => e.Date == date && e.OdometerKm == row.OdometerKm && e.CategoryId == category.Id && e.Amount == row.Amount))
            {
                skipped++;
                continue;
            }

            _db.Expenses.Add(new Expense
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
        var serviceCategories = await _db.ServiceCategories.Where(c => c.UserId == null || c.UserId == userId)
            .OrderBy(c => c.UserId).ToListAsync(cancellationToken);
        var oldServices = await _db.ServiceRecords.AsNoTracking().Where(s => s.VehicleId == vehicleId).ToListAsync(cancellationToken);
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

            _db.ServiceRecords.Add(record);
            services++;
        }

        // Egy mentés, így hibánál semmi nem kerül be.
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return Problem(statusCode: 400, title: "The file contains invalid data.");
        }
        await _db.UpdateCurrentKm(vehicleId, null, cancellationToken);

        return new DrivvoImportResultDto(refuelings, expenses, services, skipped);
    }

    private static string? Cut(string? value, int max)
    {
        return value?.Length > max ? value[..max] : value;
    }
}
