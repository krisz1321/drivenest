using Drivenest.Api.Data;
using Drivenest.Api.Data.Entities;
using Drivenest.Api.Dtos.Stats;
using Drivenest.Api.Extensions;
using Drivenest.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Drivenest.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/vehicles/{vehicleId:int}/stats")]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
public class StatsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly TimeProvider _clock;

    public StatsController(AppDbContext db, TimeProvider clock)
    {
        _db = db;
        _clock = clock;
    }

    private Task<bool> OwnsVehicle(int vehicleId, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        return _db.Vehicles.AnyAsync(v => v.Id == vehicleId && v.UserId == userId, cancellationToken);
    }

    [HttpGet("consumption")]
    [ProducesResponseType(typeof(ConsumptionDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ConsumptionDto>> GetConsumption(int vehicleId, CancellationToken cancellationToken)
    {
        if (!await OwnsVehicle(vehicleId, cancellationToken)) return NotFound();
        var refuelings = await _db.Refuelings.AsNoTracking().Where(r => r.VehicleId == vehicleId).ToListAsync(cancellationToken);
        return FuelConsumptionCalculator.Calculate(refuelings);
    }

    // Ha nincs megadva, a "to" a mai nap, a "from" nélkül az összes bejegyzés számít.
    [HttpGet("summary")]
    [ProducesResponseType(typeof(StatsSummaryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<StatsSummaryDto>> GetSummary(int vehicleId, [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var vehicle = await _db.Vehicles.AsNoTracking()
            .SingleOrDefaultAsync(v => v.Id == vehicleId && v.UserId == userId, cancellationToken);
        if (vehicle is null) return NotFound();

        var end = to ?? DateOnly.FromDateTime(_clock.GetLocalNow().DateTime);
        if (from > end)
        {
            ModelState.AddModelError(nameof(from), "The start date must not be after the end date.");
            return ValidationProblem(ModelState);
        }

        var (refuelings, services, expenses) = await LoadEntries(vehicleId, cancellationToken);
        return StatsSummaryCalculator.Calculate(vehicle, refuelings, services, expenses, from, end);
    }

    // Havi bontás a diagramokhoz, az üres hónapok is benne vannak.
    [HttpGet("monthly")]
    [ProducesResponseType(typeof(List<MonthlyStatsDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<List<MonthlyStatsDto>>> GetMonthly(int vehicleId, [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var vehicle = await _db.Vehicles.AsNoTracking()
            .SingleOrDefaultAsync(v => v.Id == vehicleId && v.UserId == userId, cancellationToken);
        if (vehicle is null) return NotFound();

        var end = to ?? DateOnly.FromDateTime(_clock.GetLocalNow().DateTime);
        if (from > end)
        {
            ModelState.AddModelError(nameof(from), "The start date must not be after the end date.");
            return ValidationProblem(ModelState);
        }

        var (refuelings, services, expenses) = await LoadEntries(vehicleId, cancellationToken);
        return StatsMonthlyCalculator.Calculate(vehicle, refuelings, services, expenses, from, end);
    }

    private async Task<(List<Refueling>, List<ServiceRecord>, List<Expense>)> LoadEntries(int vehicleId, CancellationToken cancellationToken)
    {
        var refuelings = await _db.Refuelings.AsNoTracking().Where(r => r.VehicleId == vehicleId).ToListAsync(cancellationToken);
        var services = await _db.ServiceRecords.AsNoTracking().Include(s => s.Items)
            .Where(s => s.VehicleId == vehicleId).ToListAsync(cancellationToken);
        var expenses = await _db.Expenses.AsNoTracking().Where(e => e.VehicleId == vehicleId).ToListAsync(cancellationToken);
        return (refuelings, services, expenses);
    }
}
