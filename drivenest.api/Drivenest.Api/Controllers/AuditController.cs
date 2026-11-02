using System.Globalization;
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
    // Az ennél több nappal az eredeti dátum után történt létrehozás, módosítás és törlés számít változásnak.
    private const int LateDays = 7;

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
        var selected = Selected(types, AuditEntryTypes.All, nameof(types));
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var vehicles = OwnedVehicles(vehicleId);
        if (vehicleId.HasValue && !await vehicles.AnyAsync(cancellationToken)) return NotFound();

        var entries = await LoadEntries(vehicles, selected, cancellationToken);

        // A 7 napon belüli törlés nem a Változások között látszik, a sor viszont már csak a naplóban van meg.
        var deletions = await LoadLogs(vehicleId, selected, [AuditActions.Deleted], cancellationToken);
        entries.AddRange(deletions.Where(a => !IsLate(a)).Select(ToDeletedDto));

        return entries.OrderByDescending(e => e.DeletedAt ?? e.UpdatedAt ?? e.CreatedAt).ThenByDescending(e => e.Id).ToList();
    }

    // Módosítások, törlések és az utólag rögzített bejegyzések, a legfrissebbel kezdve.
    [HttpGet("changes")]
    [ProducesResponseType(typeof(List<AuditChangeDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<List<AuditChangeDto>>> GetChanges([FromQuery] int? vehicleId, [FromQuery] string[]? types,
        [FromQuery] string[]? actions, CancellationToken cancellationToken)
    {
        var selectedTypes = Selected(types, AuditEntryTypes.All, nameof(types));
        var selectedActions = Selected(actions, AuditActions.All, nameof(actions));
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var vehicles = OwnedVehicles(vehicleId);
        if (vehicleId.HasValue && !await vehicles.AnyAsync(cancellationToken)) return NotFound();

        var logs = await LoadLogs(vehicleId, selectedTypes, selectedActions, cancellationToken);
        var changes = logs.Where(IsLate).Select(ToDto).ToList();

        // A létrehozás nincs a naplóban, a késői rögzítést a dátumokból számoljuk.
        if (selectedActions.Contains(AuditActions.Added))
        {
            var entries = await LoadEntries(vehicles, selectedTypes, cancellationToken);
            changes.AddRange(entries.Where(e => DaysLate(e) > LateDays).Select(ToAddedDto));
        }

        return changes.OrderByDescending(c => c.ChangedAt).ThenByDescending(c => c.EntityId).ToList();
    }

    // Üres szűrő esetén minden érték kell. Ismeretlen értéknél a ModelState-be kerül a hiba.
    private string[] Selected(string[]? values, string[] allowed, string name)
    {
        var selected = values is { Length: > 0 } ? values : allowed;
        if (selected.Except(allowed).Any()) ModelState.AddModelError(name, "Unknown audit filter value.");
        return selected;
    }

    private IQueryable<Vehicle> OwnedVehicles(int? vehicleId)
    {
        var userId = User.GetUserId();
        var vehicles = _db.Vehicles.AsNoTracking().Where(v => v.UserId == userId);
        return vehicleId.HasValue ? vehicles.Where(v => v.Id == vehicleId.Value) : vehicles;
    }

    private Task<List<AuditLog>> LoadLogs(int? vehicleId, string[] types, string[] actions, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var query = _db.AuditLogs.AsNoTracking().Include(a => a.Changes)
            .Where(a => a.UserId == userId && types.Contains(a.EntityType) && actions.Contains(a.Action));
        if (vehicleId.HasValue) query = query.Where(a => a.VehicleId == vehicleId.Value);
        return query.ToListAsync(cancellationToken);
    }

    private async Task<List<AuditEntryDto>> LoadEntries(IQueryable<Vehicle> vehicles, string[] types, CancellationToken cancellationToken)
    {
        var entries = new List<AuditEntryDto>();

        if (types.Contains(AuditEntryTypes.Vehicle))
        {
            var items = await vehicles.ToListAsync(cancellationToken);
            entries.AddRange(items.Select(ToDto));
        }

        if (types.Contains(AuditEntryTypes.Refueling))
        {
            var items = await _db.Refuelings.AsNoTracking().Include(r => r.Vehicle)
                .Where(r => vehicles.Any(v => v.Id == r.VehicleId))
                .ToListAsync(cancellationToken);
            entries.AddRange(items.Select(ToDto));
        }

        if (types.Contains(AuditEntryTypes.Service))
        {
            var items = await _db.ServiceRecords.AsNoTracking().Include(s => s.Vehicle)
                .Include(s => s.Items).ThenInclude(i => i.Category)
                .Where(s => vehicles.Any(v => v.Id == s.VehicleId))
                .ToListAsync(cancellationToken);
            entries.AddRange(items.Select(ToDto));
        }

        if (types.Contains(AuditEntryTypes.Expense))
        {
            var items = await _db.Expenses.AsNoTracking().Include(e => e.Vehicle).Include(e => e.Category)
                .Where(e => vehicles.Any(v => v.Id == e.VehicleId))
                .ToListAsync(cancellationToken);
            entries.AddRange(items.Select(ToDto));
        }

        return entries;
    }

    // Hány nappal a saját dátuma után rögzítették (a járműnek nincs dátuma).
    private static int DaysLate(AuditEntryDto e)
    {
        return e.Date is { } date ? DateOnly.FromDateTime(e.CreatedAt).DayNumber - date.DayNumber : 0;
    }

    // Ha a dátumot is átírták, a régi és az új közül a korábbi számít, így az átírás nem rejtheti el magát.
    // A járműnek nincs dátuma, ott a létrehozás napja számít.
    private static DateOnly? OriginalDate(AuditLog a)
    {
        var oldValue = a.Changes.FirstOrDefault(c => c.Field == "date")?.OldValue;
        var oldDate = oldValue is null ? (DateOnly?)null : DateOnly.ParseExact(oldValue, "yyyy-MM-dd", CultureInfo.InvariantCulture);
        if (oldDate < a.Date) return oldDate;
        if (a.Date is not null) return a.Date;
        return a.EntityCreatedAt is { } created ? DateOnly.FromDateTime(created) : null;
    }

    private static bool IsLate(AuditLog a)
    {
        return OriginalDate(a) is not { } date || DateOnly.FromDateTime(a.CreatedAt).DayNumber - date.DayNumber > LateDays;
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

    private static AuditEntryDto ToDeletedDto(AuditLog a) => new(a.EntityType, a.EntityId, a.VehicleId, a.LicensePlate, a.VehicleName,
        a.Date, a.Summary, a.Amount, a.Liters, Utc(a.EntityCreatedAt ?? a.CreatedAt), null, Utc(a.CreatedAt));

    private static AuditChangeDto ToDto(AuditLog a) => new(a.Action, a.EntityType, a.EntityId, a.VehicleId, a.LicensePlate, a.VehicleName,
        a.Date, a.Summary, a.Amount, a.Liters, Utc(a.CreatedAt), null,
        a.Changes.OrderBy(c => c.Id).Select(c => new AuditChangeFieldDto(c.Field, c.OldValue, c.NewValue)).ToList());

    private static AuditChangeDto ToAddedDto(AuditEntryDto e) => new(AuditActions.Added, e.Type, e.Id, e.VehicleId, e.LicensePlate, e.VehicleName,
        e.Date, e.Summary, e.Amount, e.Liters, e.CreatedAt, DaysLate(e), []);
}
