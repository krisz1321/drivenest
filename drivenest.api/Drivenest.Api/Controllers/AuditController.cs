using Drivenest.Api.Data;
using Drivenest.Api.Data.Entities;
using Drivenest.Api.Dtos.Audit;
using Drivenest.Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Drivenest.Api.Controllers;

// Változásnapló: a felhasználó járműveinek és bejegyzéseinek létrehozási és módosítási adatai.
[ApiController]
[Authorize]
[Route("api/audit")]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
public class AuditController : ControllerBase
{
    private readonly AppDbContext _db;

    public AuditController(AppDbContext db)
    {
        _db = db;
    }

    // Szűrő nélkül minden típust visszaad, a legutóbb változott bejegyzéssel kezdve.
    [HttpGet]
    [ProducesResponseType(typeof(List<AuditEntryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<List<AuditEntryDto>>> GetAll([FromQuery] int? vehicleId, [FromQuery] string[]? types, CancellationToken cancellationToken)
    {
        var selected = types is { Length: > 0 } ? types : AuditEntryTypes.All;
        if (selected.Except(AuditEntryTypes.All).Any())
        {
            ModelState.AddModelError(nameof(types), "Unknown audit entry type.");
            return ValidationProblem(ModelState);
        }

        var userId = User.GetUserId();
        var vehicles = _db.Vehicles.AsNoTracking().Where(v => v.UserId == userId);
        if (vehicleId.HasValue)
        {
            vehicles = vehicles.Where(v => v.Id == vehicleId.Value);
            if (!await vehicles.AnyAsync(cancellationToken)) return NotFound();
        }

        var entries = new List<AuditEntryDto>();

        if (selected.Contains(AuditEntryTypes.Vehicle))
        {
            var items = await vehicles.ToListAsync(cancellationToken);
            entries.AddRange(items.Select(ToDto));
        }

        if (selected.Contains(AuditEntryTypes.Refueling))
        {
            var items = await _db.Refuelings.AsNoTracking().Include(r => r.Vehicle)
                .Where(r => vehicles.Any(v => v.Id == r.VehicleId))
                .ToListAsync(cancellationToken);
            entries.AddRange(items.Select(ToDto));
        }

        if (selected.Contains(AuditEntryTypes.Service))
        {
            var items = await _db.ServiceRecords.AsNoTracking().Include(s => s.Vehicle)
                .Include(s => s.Items).ThenInclude(i => i.Category)
                .Where(s => vehicles.Any(v => v.Id == s.VehicleId))
                .ToListAsync(cancellationToken);
            entries.AddRange(items.Select(ToDto));
        }

        if (selected.Contains(AuditEntryTypes.Expense))
        {
            var items = await _db.Expenses.AsNoTracking().Include(e => e.Vehicle).Include(e => e.Category)
                .Where(e => vehicles.Any(v => v.Id == e.VehicleId))
                .ToListAsync(cancellationToken);
            entries.AddRange(items.Select(ToDto));
        }

        return entries.OrderByDescending(e => e.UpdatedAt ?? e.CreatedAt).ThenByDescending(e => e.Id).ToList();
    }

    private static string VehicleName(Vehicle v) => $"{v.Make} {v.Model}";

    private static DateTime Utc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);

    private static DateTime? Utc(DateTime? value) => value is null ? null : Utc(value.Value);

    private static AuditEntryDto ToDto(Vehicle v) => new(AuditEntryTypes.Vehicle, v.Id, v.Id, v.LicensePlate, VehicleName(v),
        null, null, null, null, Utc(v.CreatedAt), Utc(v.UpdatedAt));

    private static AuditEntryDto ToDto(Refueling r) => new(AuditEntryTypes.Refueling, r.Id, r.VehicleId, r.Vehicle.LicensePlate, VehicleName(r.Vehicle),
        r.Date, null, r.TotalAmount, r.Liters, Utc(r.CreatedAt), Utc(r.UpdatedAt));

    private static AuditEntryDto ToDto(ServiceRecord s) => new(AuditEntryTypes.Service, s.Id, s.VehicleId, s.Vehicle.LicensePlate, VehicleName(s.Vehicle),
        s.Date, string.Join(", ", s.Items.OrderBy(i => i.Id).Select(i => i.Category.Name)), s.Items.Sum(i => i.Amount), null, Utc(s.CreatedAt), Utc(s.UpdatedAt));

    private static AuditEntryDto ToDto(Expense e) => new(AuditEntryTypes.Expense, e.Id, e.VehicleId, e.Vehicle.LicensePlate, VehicleName(e.Vehicle),
        e.Date, e.Category.Name, e.Amount, null, Utc(e.CreatedAt), Utc(e.UpdatedAt));
}
