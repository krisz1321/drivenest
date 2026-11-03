using Drivenest.Api.Data;
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

    public StatsController(AppDbContext db)
    {
        _db = db;
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
}
