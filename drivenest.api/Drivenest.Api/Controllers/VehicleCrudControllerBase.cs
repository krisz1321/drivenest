using Drivenest.Api.Data;
using Drivenest.Api.Data.Entities;
using Drivenest.Api.Dtos.Vehicles;
using Drivenest.Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Drivenest.Api.Controllers;

[ApiController]
[Authorize]
public abstract class VehicleCrudControllerBase : ControllerBase
{
    private readonly AppDbContext _db;

    protected VehicleCrudControllerBase(AppDbContext db) => _db = db;

    private IQueryable<Vehicle> OwnedVehicles => _db.Vehicles.Where(v => v.UserId == User.GetUserId());

    [HttpGet]
    public async Task<ActionResult<List<VehicleDto>>> GetAll(CancellationToken cancellationToken)
    {
        return await OwnedVehicles.AsNoTracking().OrderBy(v => v.Id)
            .Select(v => new VehicleDto(v.Id, v.FuelTypeId, v.LicensePlate, v.Vin,
                v.Make, v.Model, v.Year, v.InitialKm, v.CurrentKm))
            .ToListAsync(cancellationToken);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<VehicleDto>> GetById(int id, CancellationToken cancellationToken)
    {
        var vehicle = await OwnedVehicles.AsNoTracking().SingleOrDefaultAsync(v => v.Id == id, cancellationToken);
        return vehicle is null ? NotFound() : Ok(ToDto(vehicle));
    }

    [HttpPost]
    public async Task<ActionResult<VehicleDto>> Create(VehicleRequest request, CancellationToken cancellationToken)
    {
        await ValidateReferences(request, null, cancellationToken);
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var vehicle = new Vehicle { UserId = User.GetUserId() };
        Apply(request, vehicle);
        _db.Vehicles.Add(vehicle);
        var error = await Save(cancellationToken);
        if (error is not null) return error;
        return CreatedAtAction(nameof(GetById), new { id = vehicle.Id }, ToDto(vehicle));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<VehicleDto>> Update(int id, VehicleRequest request, CancellationToken cancellationToken)
    {
        var vehicle = await OwnedVehicles.SingleOrDefaultAsync(v => v.Id == id, cancellationToken);
        if (vehicle is null) return NotFound();
        await ValidateReferences(request, id, cancellationToken);
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        Apply(request, vehicle);
        var error = await Save(cancellationToken);
        return error is not null ? error : Ok(ToDto(vehicle));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var vehicle = await OwnedVehicles.SingleOrDefaultAsync(v => v.Id == id, cancellationToken);
        if (vehicle is null) return NotFound();

        if (await _db.Refuelings.AnyAsync(r => r.VehicleId == id, cancellationToken)
            || await _db.ServiceRecords.AnyAsync(r => r.VehicleId == id, cancellationToken)
            || await _db.Expenses.AnyAsync(r => r.VehicleId == id, cancellationToken)
            || await _db.Reminders.AnyAsync(r => r.VehicleId == id, cancellationToken))
            return Problem(statusCode: 409, title: "Remove the vehicle's linked records before deleting it.");

        _db.Vehicles.Remove(vehicle);
        var error = await Save(cancellationToken);
        return error is not null ? error : NoContent();
    }

    private async Task ValidateReferences(VehicleRequest request, int? id, CancellationToken cancellationToken)
    {
        if (!await _db.FuelTypes.AnyAsync(f => f.Id == request.FuelTypeId, cancellationToken))
            ModelState.AddModelError(nameof(request.FuelTypeId), "The fuel type does not exist.");

        var plate = request.LicensePlate.Trim().ToUpperInvariant();
        var vehicles = OwnedVehicles;
        if (id.HasValue) vehicles = vehicles.Where(v => v.Id != id.Value);
        if (await vehicles.AnyAsync(v => v.LicensePlate == plate, cancellationToken))
            ModelState.AddModelError(nameof(request.LicensePlate), "You already have a vehicle with this license plate.");
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
            return Problem(statusCode: 409, title: "The vehicle changed or was deleted. Reload and try again.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: 2601 or 2627 })
        {
            return Problem(statusCode: 409, title: "You already have a vehicle with this license plate.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: 547 })
        {
            return Problem(statusCode: 409, title: "Linked records prevent this operation. Reload and try again.");
        }
    }

    private static void Apply(VehicleRequest request, Vehicle vehicle)
    {
        vehicle.FuelTypeId = request.FuelTypeId;
        vehicle.LicensePlate = request.LicensePlate.Trim().ToUpperInvariant();
        vehicle.Vin = request.Vin?.Trim().ToUpperInvariant();
        vehicle.Make = request.Make.Trim();
        vehicle.Model = request.Model.Trim();
        vehicle.Year = request.Year;
        vehicle.InitialKm = request.InitialKm;
        vehicle.CurrentKm = request.CurrentKm;
    }

    private static VehicleDto ToDto(Vehicle v) => new(v.Id, v.FuelTypeId, v.LicensePlate,
        v.Vin, v.Make, v.Model, v.Year, v.InitialKm, v.CurrentKm);
}
