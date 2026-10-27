using Drivenest.Api.Data;
using Drivenest.Api.Data.Entities;
using Drivenest.Api.Dtos.ServiceRecords;
using Drivenest.Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Drivenest.Api.Controllers;

// Szervizbejegyzések: hasonló, mint a kiadások (ExpensesController), csak egy szervizhez több tétel tartozik.
[ApiController]
[Authorize]
[Route("api/vehicles/{vehicleId:int}/service-records")]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
public class ServiceRecordsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly TimeProvider _clock;

    public ServiceRecordsController(AppDbContext db, TimeProvider clock)
    {
        _db = db;
        _clock = clock;
    }

    private Task<bool> OwnsVehicle(int vehicleId, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        return _db.Vehicles.AnyAsync(v => v.Id == vehicleId && v.UserId == userId, cancellationToken);
    }

    // A beépített típusok mindenkinek látszanak, a saját típusok csak a tulajdonosuknak.
    private IQueryable<ServiceCategory> VisibleCategories()
    {
        var userId = User.GetUserId();
        return _db.ServiceCategories.Where(c => c.UserId == null || c.UserId == userId);
    }

    // A szervizek a tételeikkel és a tételek típusával együtt
    private IQueryable<ServiceRecord> WithItems()
    {
        return _db.ServiceRecords.Include(s => s.Items).ThenInclude(i => i.Category);
    }

    [HttpGet]
    [ProducesResponseType(typeof(List<ServiceRecordDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<ServiceRecordDto>>> GetAll(int vehicleId, CancellationToken cancellationToken)
    {
        if (!await OwnsVehicle(vehicleId, cancellationToken)) return NotFound();

        var records = await WithItems().AsNoTracking()
            .Where(s => s.VehicleId == vehicleId)
            .OrderByDescending(s => s.Date).ThenByDescending(s => s.OdometerKm).ThenByDescending(s => s.Id)
            .ToListAsync(cancellationToken);
        return records.Select(ToDto).ToList();
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(ServiceRecordDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ServiceRecordDto>> GetById(int vehicleId, int id, CancellationToken cancellationToken)
    {
        if (!await OwnsVehicle(vehicleId, cancellationToken)) return NotFound();

        var record = await WithItems().AsNoTracking()
            .SingleOrDefaultAsync(s => s.Id == id && s.VehicleId == vehicleId, cancellationToken);
        return record is null ? NotFound() : Ok(ToDto(record));
    }

    [HttpPost]
    [ProducesResponseType(typeof(ServiceRecordDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ServiceRecordDto>> Create(int vehicleId, ServiceRecordRequest request, CancellationToken cancellationToken)
    {
        if (!await OwnsVehicle(vehicleId, cancellationToken)) return NotFound();

        await ValidateCategories(request, cancellationToken);
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var record = new ServiceRecord { VehicleId = vehicleId, CreatedAt = _clock.GetUtcNow().UtcDateTime };
        Apply(request, record);
        _db.ServiceRecords.Add(record);

        var error = await Save(cancellationToken);
        if (error is not null) return error;
        await _db.UpdateCurrentKm(vehicleId, null, cancellationToken);

        // Újra betöltjük, hogy a válaszban a típusok neve is benne legyen.
        var saved = await WithItems().AsNoTracking().SingleAsync(s => s.Id == record.Id, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { vehicleId, id = record.Id }, ToDto(saved));
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(ServiceRecordDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ServiceRecordDto>> Update(int vehicleId, int id, ServiceRecordRequest request, CancellationToken cancellationToken)
    {
        if (!await OwnsVehicle(vehicleId, cancellationToken)) return NotFound();

        var record = await _db.ServiceRecords.Include(s => s.Items)
            .SingleOrDefaultAsync(s => s.Id == id && s.VehicleId == vehicleId, cancellationToken);
        if (record is null) return NotFound();

        await ValidateCategories(request, cancellationToken);
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var oldKm = record.OdometerKm;
        Apply(request, record);
        var error = await Save(cancellationToken);
        if (error is not null) return error;
        await _db.UpdateCurrentKm(vehicleId, oldKm, cancellationToken);

        var saved = await WithItems().AsNoTracking().SingleAsync(s => s.Id == record.Id, cancellationToken);
        return Ok(ToDto(saved));
    }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(int vehicleId, int id, CancellationToken cancellationToken)
    {
        if (!await OwnsVehicle(vehicleId, cancellationToken)) return NotFound();

        var record = await _db.ServiceRecords.SingleOrDefaultAsync(s => s.Id == id && s.VehicleId == vehicleId, cancellationToken);
        if (record is null) return NotFound();

        // A tételeket az adatbázis törli (cascade).
        _db.ServiceRecords.Remove(record);
        var error = await Save(cancellationToken);
        if (error is not null) return error;
        await _db.UpdateCurrentKm(vehicleId, record.OdometerKm, cancellationToken);
        return NoContent();
    }

    // Minden tétel típusa létezzen, és látható legyen a felhasználónak.
    private async Task ValidateCategories(ServiceRecordRequest request, CancellationToken cancellationToken)
    {
        var ids = request.Items.Select(i => i.CategoryId).Where(id => id > 0).Distinct().ToList();
        if (ids.Count == 0) return; // ezt már a validáció jelezte

        var found = await VisibleCategories().CountAsync(c => ids.Contains(c.Id), cancellationToken);
        if (found != ids.Count)
            ModelState.AddModelError(nameof(request.Items), "A service type does not exist.");
    }

    private async Task<ActionResult?> Save(CancellationToken cancellationToken)
    {
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return null;
        }
        catch (DbUpdateConcurrencyException)
        {
            return Problem(statusCode: 409, title: "The service record changed or was deleted. Reload and try again.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: 547 })
        {
            return Problem(statusCode: 409, title: "The linked vehicle or service type changed or was deleted. Reload and try again.");
        }
    }

    // Üres vagy csak szóközből álló szöveg helyett null-t mentünk.
    private static string? CleanText(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static void Apply(ServiceRecordRequest request, ServiceRecord record)
    {
        record.Date = request.Date;
        record.OdometerKm = request.OdometerKm!.Value;
        record.Provider = CleanText(request.Provider);
        record.Description = CleanText(request.Description);

        // Tételek: ami kimaradt, törlődik; ami megmaradt, új összeget kap; ami új, hozzáadódik.
        record.Items.RemoveAll(i => !request.Items.Any(r => r.CategoryId == i.CategoryId));
        foreach (var item in request.Items)
        {
            var existing = record.Items.FirstOrDefault(i => i.CategoryId == item.CategoryId);
            if (existing is null)
                record.Items.Add(new ServiceRecordItem { CategoryId = item.CategoryId, Amount = item.Amount });
            else
                existing.Amount = item.Amount;
        }
    }

    private static ServiceRecordDto ToDto(ServiceRecord s) => new(s.Id, s.VehicleId, s.Date, s.OdometerKm,
        s.Items.Sum(i => i.Amount), s.Provider, s.Description, DateTime.SpecifyKind(s.CreatedAt, DateTimeKind.Utc),
        s.Items.OrderBy(i => i.Id).Select(i => new ServiceRecordItemDto(i.CategoryId, i.Category.Name, i.Amount)).ToList());
}
