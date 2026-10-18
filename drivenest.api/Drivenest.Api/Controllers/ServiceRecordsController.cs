using Drivenest.Api.Data;
using Drivenest.Api.Data.Entities;
using Drivenest.Api.Dtos.ServiceRecords;
using Drivenest.Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Drivenest.Api.Controllers;

// Szervizbejegyzések: ugyanúgy működik, mint a kiadások (ExpensesController).
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

    [HttpGet]
    [ProducesResponseType(typeof(List<ServiceRecordDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<ServiceRecordDto>>> GetAll(int vehicleId, CancellationToken cancellationToken)
    {
        if (!await OwnsVehicle(vehicleId, cancellationToken)) return NotFound();

        return await _db.ServiceRecords.AsNoTracking()
            .Where(s => s.VehicleId == vehicleId)
            .OrderByDescending(s => s.Date).ThenByDescending(s => s.OdometerKm).ThenByDescending(s => s.Id)
            .Select(s => new ServiceRecordDto(s.Id, s.VehicleId, s.CategoryId, s.Category.Name, s.Date,
                s.OdometerKm, s.Amount, s.Provider, s.Description, DateTime.SpecifyKind(s.CreatedAt, DateTimeKind.Utc)))
            .ToListAsync(cancellationToken);
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(ServiceRecordDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ServiceRecordDto>> GetById(int vehicleId, int id, CancellationToken cancellationToken)
    {
        if (!await OwnsVehicle(vehicleId, cancellationToken)) return NotFound();

        var record = await _db.ServiceRecords.AsNoTracking()
            .Include(s => s.Category)
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

        await ValidateCategory(request, cancellationToken);
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var record = new ServiceRecord { VehicleId = vehicleId, CreatedAt = _clock.GetUtcNow().UtcDateTime };
        Apply(request, record);
        _db.ServiceRecords.Add(record);

        var error = await Save(cancellationToken);
        if (error is not null) return error;

        // A válaszban a típus neve is kell.
        await _db.Entry(record).Reference(s => s.Category).LoadAsync(cancellationToken);
        return CreatedAtAction(nameof(GetById), new { vehicleId, id = record.Id }, ToDto(record));
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(ServiceRecordDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ServiceRecordDto>> Update(int vehicleId, int id, ServiceRecordRequest request, CancellationToken cancellationToken)
    {
        if (!await OwnsVehicle(vehicleId, cancellationToken)) return NotFound();

        var record = await _db.ServiceRecords.SingleOrDefaultAsync(s => s.Id == id && s.VehicleId == vehicleId, cancellationToken);
        if (record is null) return NotFound();

        await ValidateCategory(request, cancellationToken);
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        Apply(request, record);
        var error = await Save(cancellationToken);
        if (error is not null) return error;

        await _db.Entry(record).Reference(s => s.Category).LoadAsync(cancellationToken);
        return Ok(ToDto(record));
    }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(int vehicleId, int id, CancellationToken cancellationToken)
    {
        if (!await OwnsVehicle(vehicleId, cancellationToken)) return NotFound();

        var record = await _db.ServiceRecords.SingleOrDefaultAsync(s => s.Id == id && s.VehicleId == vehicleId, cancellationToken);
        if (record is null) return NotFound();

        _db.ServiceRecords.Remove(record);
        var error = await Save(cancellationToken);
        return error is not null ? error : NoContent();
    }

    private async Task ValidateCategory(ServiceRecordRequest request, CancellationToken cancellationToken)
    {
        if (request.CategoryId <= 0) return; // ezt már a [Range] jelezte

        if (!await VisibleCategories().AnyAsync(c => c.Id == request.CategoryId, cancellationToken))
            ModelState.AddModelError(nameof(request.CategoryId), "The service type does not exist.");
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
        record.CategoryId = request.CategoryId;
        record.OdometerKm = request.OdometerKm!.Value;
        record.Amount = request.Amount;
        record.Provider = CleanText(request.Provider);
        record.Description = CleanText(request.Description);
    }

    private static ServiceRecordDto ToDto(ServiceRecord s) => new(s.Id, s.VehicleId, s.CategoryId, s.Category.Name, s.Date,
        s.OdometerKm, s.Amount, s.Provider, s.Description, DateTime.SpecifyKind(s.CreatedAt, DateTimeKind.Utc));
}
