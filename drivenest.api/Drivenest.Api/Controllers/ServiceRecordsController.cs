using Drivenest.Api.Data;
using Drivenest.Api.Data.Entities;
using Drivenest.Api.Dtos.ServiceRecords;
using Drivenest.Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Drivenest.Api.Controllers;

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

    [HttpGet]
    [ProducesResponseType(typeof(List<ServiceRecordDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<ServiceRecordDto>>> GetAll(int vehicleId, CancellationToken cancellationToken)
    {
        if (!await OwnsVehicle(vehicleId, cancellationToken)) return NotFound();

        return await _db.ServiceRecords.AsNoTracking()
            .Where(e => e.VehicleId == vehicleId)
            .OrderByDescending(e => e.Date).ThenByDescending(e => e.OdometerKm).ThenByDescending(e => e.Id)
            .Select(e => new ServiceRecordDto(e.Id, e.VehicleId, e.CategoryId, e.Category.Name, e.Date,
                e.OdometerKm, e.Provider, e.Description, e.PartsCost, e.LaborCost, DateTime.SpecifyKind(e.CreatedAt, DateTimeKind.Utc)))
            .ToListAsync(cancellationToken);
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(ServiceRecordDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ServiceRecordDto>> GetById(int vehicleId, int id, CancellationToken cancellationToken)
    {
        if (!await OwnsVehicle(vehicleId, cancellationToken)) return NotFound();

        var entry = await _db.ServiceRecords.AsNoTracking()
            .Include(e => e.Category)
            .SingleOrDefaultAsync(e => e.Id == id && e.VehicleId == vehicleId, cancellationToken);
        return entry is null ? NotFound() : Ok(ToDto(entry));
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

        var entry = new ServiceRecord { VehicleId = vehicleId, CreatedAt = _clock.GetUtcNow().UtcDateTime };
        Apply(request, entry);
        _db.ServiceRecords.Add(entry);

        var error = await Save(cancellationToken);
        if (error is not null) return error;

        await _db.Entry(entry).Reference(e => e.Category).LoadAsync(cancellationToken);
        return CreatedAtAction(nameof(GetById), new { vehicleId, id = entry.Id }, ToDto(entry));
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(ServiceRecordDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ServiceRecordDto>> Update(int vehicleId, int id, ServiceRecordRequest request, CancellationToken cancellationToken)
    {
        if (!await OwnsVehicle(vehicleId, cancellationToken)) return NotFound();

        var entry = await _db.ServiceRecords.SingleOrDefaultAsync(e => e.Id == id && e.VehicleId == vehicleId, cancellationToken);
        if (entry is null) return NotFound();

        await ValidateCategory(request, cancellationToken);
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        Apply(request, entry);
        var error = await Save(cancellationToken);
        if (error is not null) return error;

        await _db.Entry(entry).Reference(e => e.Category).LoadAsync(cancellationToken);
        return Ok(ToDto(entry));
    }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(int vehicleId, int id, CancellationToken cancellationToken)
    {
        if (!await OwnsVehicle(vehicleId, cancellationToken)) return NotFound();

        var entry = await _db.ServiceRecords.SingleOrDefaultAsync(e => e.Id == id && e.VehicleId == vehicleId, cancellationToken);
        if (entry is null) return NotFound();

        _db.ServiceRecords.Remove(entry);
        var error = await Save(cancellationToken);
        return error is not null ? error : NoContent();
    }

    private async Task ValidateCategory(ServiceRecordRequest request, CancellationToken cancellationToken)
    {
        if (request.CategoryId <= 0) return;

        if (!await _db.ServiceCategories.AnyAsync(c => c.Id == request.CategoryId, cancellationToken))
            ModelState.AddModelError(nameof(request.CategoryId), "The service category does not exist.");
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
            return Problem(statusCode: 409, title: "The linked vehicle or category changed or was deleted. Reload and try again.");
        }
    }

    private static string? CleanText(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static void Apply(ServiceRecordRequest request, ServiceRecord entry)
    {
        entry.Date = request.Date;
        entry.CategoryId = request.CategoryId;
        entry.OdometerKm = request.OdometerKm!.Value;
        entry.PartsCost = request.PartsCost;
        entry.LaborCost = request.LaborCost;
        entry.Provider = CleanText(request.Provider);
        entry.Description = CleanText(request.Description);
    }

    private static ServiceRecordDto ToDto(ServiceRecord e) => new(e.Id, e.VehicleId, e.CategoryId, e.Category.Name, e.Date,
        e.OdometerKm, e.Provider, e.Description, e.PartsCost, e.LaborCost, DateTime.SpecifyKind(e.CreatedAt, DateTimeKind.Utc));
}

