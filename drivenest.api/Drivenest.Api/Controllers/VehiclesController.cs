using Drivenest.Api.Data;
using Drivenest.Api.Dtos.Import;
using Drivenest.Api.Dtos.Vehicles;
using Drivenest.Api.Extensions;
using Drivenest.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Drivenest.Api.Controllers;

[Route("api/vehicles")]
public class VehiclesController : VehicleCrudControllerBase
{
    public VehiclesController(AppDbContext db, TimeProvider clock) : base(db, clock) { }

    [HttpPost("import/drivvo")]
    [ProducesResponseType(typeof(DrivvoVehicleImportResultDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<DrivvoVehicleImportResultDto>> ImportDrivvo(
        [FromForm] VehicleRequest request, IFormFile file, [FromServices] DrivvoImportService importService,
        CancellationToken cancellationToken)
    {
        await ValidateReferences(request, null, cancellationToken);
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        DrivvoData data;
        try
        {
            data = await importService.ReadAsync(file, cancellationToken);
        }
        catch (FormatException ex)
        {
            return Problem(statusCode: 400, title: ex.Message);
        }

        var minKm = Math.Max(request.InitialKm, data.GetMaxOdometerKm() ?? 0);
        if (request.CurrentKm < minKm)
        {
            ModelState.AddModelError(nameof(request.CurrentKm),
                $"Az aktuális óraállás legalább {minKm} km legyen.");
            return ValidationProblem(ModelState);
        }

        await using var transaction = await Db.Database.BeginTransactionAsync(cancellationToken);
        var vehicle = AddVehicle(request);
        var error = await Save(cancellationToken);
        if (error is not null) return error;

        try
        {
            var result = await importService.PrepareAsync(vehicle.Id, vehicle.UserId, data, cancellationToken);
            await Db.SaveChangesAsync(cancellationToken);
            await Db.UpdateCurrentKm(vehicle.Id, cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return CreatedAtAction(nameof(GetById), new { id = vehicle.Id },
                new DrivvoVehicleImportResultDto(vehicle.Id, result));
        }
        catch (DbUpdateException)
        {
            return Problem(statusCode: 400, title: "The file contains invalid data.");
        }
    }
}
