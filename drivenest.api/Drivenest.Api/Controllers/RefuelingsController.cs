using Drivenest.Api.Data;
using Drivenest.Api.Data.Entities;
using Drivenest.Api.Dtos.Refuelings;
using Drivenest.Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Drivenest.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/vehicles/{vehicleId:int}/refuelings")]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
public class RefuelingsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly TimeProvider _clock;

    public RefuelingsController(AppDbContext db, TimeProvider clock)
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
    [ProducesResponseType(typeof(List<RefuelingDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<RefuelingDto>>> GetAll(int vehicleId, CancellationToken cancellationToken)
    {
        if (!await OwnsVehicle(vehicleId, cancellationToken)) return NotFound();
        return await _db.Refuelings.AsNoTracking().Where(r => r.VehicleId == vehicleId)
            .OrderByDescending(r => r.Date).ThenByDescending(r => r.OdometerKm).ThenByDescending(r => r.Id)
            .Select(r => new RefuelingDto(r.Id, r.VehicleId, r.Date, r.OdometerKm,
                r.Liters, r.TotalAmount, r.IsFullTank, DateTime.SpecifyKind(r.CreatedAt, DateTimeKind.Utc)))
            .ToListAsync(cancellationToken);
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(RefuelingDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<RefuelingDto>> GetById(int vehicleId, int id, CancellationToken cancellationToken)
    {
        if (!await OwnsVehicle(vehicleId, cancellationToken)) return NotFound();
        var entry = await _db.Refuelings.AsNoTracking()
            .SingleOrDefaultAsync(r => r.Id == id && r.VehicleId == vehicleId, cancellationToken);
        return entry is null ? NotFound() : Ok(ToDto(entry));
    }

    [HttpPost]
    [ProducesResponseType(typeof(RefuelingDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<RefuelingDto>> Create(int vehicleId, RefuelingRequest request, CancellationToken cancellationToken)
    {
        if (!await OwnsVehicle(vehicleId, cancellationToken)) return NotFound();
        var entry = new Refueling { VehicleId = vehicleId, CreatedAt = _clock.GetUtcNow().UtcDateTime };
        Apply(request, entry);
        _db.Refuelings.Add(entry);
        var error = await Save(cancellationToken);
        if (error is not null) return error;
        await _db.UpdateCurrentKm(vehicleId, null, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { vehicleId, id = entry.Id }, ToDto(entry));
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(RefuelingDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<RefuelingDto>> Update(int vehicleId, int id, RefuelingRequest request, CancellationToken cancellationToken)
    {
        if (!await OwnsVehicle(vehicleId, cancellationToken)) return NotFound();
        var entry = await _db.Refuelings.SingleOrDefaultAsync(r => r.Id == id && r.VehicleId == vehicleId, cancellationToken);
        if (entry is null) return NotFound();
        var oldKm = entry.OdometerKm;
        Apply(request, entry);
        var error = await Save(cancellationToken);
        if (error is not null) return error;
        await _db.UpdateCurrentKm(vehicleId, oldKm, cancellationToken);
        return Ok(ToDto(entry));
    }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(int vehicleId, int id, CancellationToken cancellationToken)
    {
        if (!await OwnsVehicle(vehicleId, cancellationToken)) return NotFound();
        var entry = await _db.Refuelings.SingleOrDefaultAsync(r => r.Id == id && r.VehicleId == vehicleId, cancellationToken);
        if (entry is null) return NotFound();
        _db.Refuelings.Remove(entry);
        var error = await Save(cancellationToken);
        if (error is not null) return error;
        await _db.UpdateCurrentKm(vehicleId, entry.OdometerKm, cancellationToken);
        return NoContent();
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
            return Problem(statusCode: 409, title: "The refueling changed or was deleted. Reload and try again.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: 547 })
        {
            return Problem(statusCode: 409, title: "The linked vehicle changed or was deleted. Reload and try again.");
        }
    }

    private static void Apply(RefuelingRequest request, Refueling entry)
    {
        entry.Date = request.Date;
        entry.OdometerKm = request.OdometerKm;
        entry.Liters = request.Liters;
        entry.TotalAmount = request.TotalAmount;
        entry.IsFullTank = request.IsFullTank;
    }

    private static RefuelingDto ToDto(Refueling r) => new(r.Id, r.VehicleId, r.Date,
        r.OdometerKm, r.Liters, r.TotalAmount, r.IsFullTank, DateTime.SpecifyKind(r.CreatedAt, DateTimeKind.Utc));
}
