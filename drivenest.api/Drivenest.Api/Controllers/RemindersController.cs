using Drivenest.Api.Data;
using Drivenest.Api.Data.Entities;
using Drivenest.Api.Dtos.Reminders;
using Drivenest.Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Drivenest.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/vehicles/{vehicleId:int}/reminders")]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
public class RemindersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly TimeProvider _clock;

    public RemindersController(AppDbContext db, TimeProvider clock)
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
    [ProducesResponseType(typeof(List<ReminderDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<ReminderDto>>> GetAll(int vehicleId, CancellationToken cancellationToken,
        bool includeCompleted = false)
    {
        if (!await OwnsVehicle(vehicleId, cancellationToken)) return NotFound();

        // Elöl a legkorábban esedékesek (a csak km-es emlékeztetők a végén).
        return await _db.Reminders.AsNoTracking()
            .Where(r => r.VehicleId == vehicleId && (includeCompleted || !r.IsCompleted))
            .OrderBy(r => r.DueDate == null).ThenBy(r => r.DueDate).ThenBy(r => r.DueOdometerKm).ThenBy(r => r.Id)
            .Select(r => new ReminderDto(r.Id, r.VehicleId, r.Title, r.DueDate, r.DueOdometerKm,
                r.IntervalMonths, r.IntervalKm, r.IsCompleted, r.RowVersion))
            .ToListAsync(cancellationToken);
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(ReminderDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ReminderDto>> GetById(int vehicleId, int id, CancellationToken cancellationToken)
    {
        if (!await OwnsVehicle(vehicleId, cancellationToken)) return NotFound();

        var entry = await _db.Reminders.AsNoTracking()
            .SingleOrDefaultAsync(r => r.Id == id && r.VehicleId == vehicleId, cancellationToken);
        return entry is null ? NotFound() : Ok(ToDto(entry));
    }

    [HttpPost]
    [ProducesResponseType(typeof(ReminderDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ReminderDto>> Create(int vehicleId, ReminderRequest request, CancellationToken cancellationToken)
    {
        if (!await OwnsVehicle(vehicleId, cancellationToken)) return NotFound();

        var entry = new Reminder { VehicleId = vehicleId };
        Apply(request, entry);
        _db.Reminders.Add(entry);

        var error = await Save(cancellationToken);
        if (error is not null) return error;

        return CreatedAtAction(nameof(GetById), new { vehicleId, id = entry.Id }, ToDto(entry));
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(ReminderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ReminderDto>> Update(int vehicleId, int id, ReminderRequest request, CancellationToken cancellationToken)
    {
        if (!await OwnsVehicle(vehicleId, cancellationToken)) return NotFound();

        var entry = await _db.Reminders.SingleOrDefaultAsync(r => r.Id == id && r.VehicleId == vehicleId, cancellationToken);
        if (entry is null) return NotFound();

        Apply(request, entry);
        var error = await Save(cancellationToken);
        return error is not null ? error : Ok(ToDto(entry));
    }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(int vehicleId, int id, CancellationToken cancellationToken)
    {
        if (!await OwnsVehicle(vehicleId, cancellationToken)) return NotFound();

        var entry = await _db.Reminders.SingleOrDefaultAsync(r => r.Id == id && r.VehicleId == vehicleId, cancellationToken);
        if (entry is null) return NotFound();

        _db.Reminders.Remove(entry);
        var error = await Save(cancellationToken);
        return error is not null ? error : NoContent();
    }

    // Szerviz nélkül a mai napból és a jármű aktuális óraállásából számolunk.
    [HttpPost("{id:int}/complete")]
    [ProducesResponseType(typeof(ReminderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ReminderDto>> Complete(int vehicleId, int id,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] ReminderCompleteRequest? request,
        CancellationToken cancellationToken)
    {
        if (!await OwnsVehicle(vehicleId, cancellationToken)) return NotFound();

        var entry = await _db.Reminders.Include(r => r.Vehicle)
            .SingleOrDefaultAsync(r => r.Id == id && r.VehicleId == vehicleId, cancellationToken);
        if (entry is null) return NotFound();

        if (entry.IsCompleted || (request?.RowVersion is { } version && !entry.RowVersion.SequenceEqual(version)))
            return Problem(statusCode: 409, title: "The reminder changed or was completed. Reload and try again.");

        var today = DateOnly.FromDateTime(_clock.GetLocalNow().DateTime);
        if (!entry.TryComplete(today, entry.Vehicle.CurrentKm))
        {
            ModelState.AddModelError(nameof(ReminderCompleteRequest), "The next due date or odometer reading is out of range.");
            return ValidationProblem(ModelState);
        }

        // Azonos esedékességnél is ellenőrizzük és frissítjük a verziót.
        _db.Entry(entry).Property(r => r.IsCompleted).IsModified = true;

        var error = await Save(cancellationToken);
        return error is not null ? error : Ok(ToDto(entry));
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
            return Problem(statusCode: 409, title: "The reminder changed or was deleted. Reload and try again.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: 547 })
        {
            return Problem(statusCode: 409, title: "The linked vehicle changed or was deleted. Reload and try again.");
        }
    }

    private static void Apply(ReminderRequest request, Reminder entry)
    {
        entry.Title = request.Title.Trim();
        entry.DueDate = request.DueDate;
        entry.DueOdometerKm = request.DueOdometerKm;
        entry.IntervalMonths = request.IntervalMonths;
        entry.IntervalKm = request.IntervalKm;
    }

    private static ReminderDto ToDto(Reminder r) => new(r.Id, r.VehicleId, r.Title, r.DueDate, r.DueOdometerKm,
        r.IntervalMonths, r.IntervalKm, r.IsCompleted, r.RowVersion);
}
