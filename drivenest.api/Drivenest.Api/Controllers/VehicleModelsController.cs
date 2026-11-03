using Drivenest.Api.Data;
using Drivenest.Api.Data.Entities;
using Drivenest.Api.Dtos.Vehicles;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Drivenest.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/vehicle-models")]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
public sealed class VehicleModelsController : ControllerBase
{
    private readonly AppDbContext _db;

    public VehicleModelsController(AppDbContext db) => _db = db;

    [HttpGet]
    [ProducesResponseType(typeof(List<VehicleModelDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<VehicleModelDto>>> GetAll(CancellationToken cancellationToken)
    {
        return await _db.VehicleModels.AsNoTracking()
            .OrderBy(m => m.VehicleBrandId).ThenBy(m => m.ModelName)
            .Select(m => new VehicleModelDto(m.Id, m.ModelName, m.VehicleBrandId))
            .ToListAsync(cancellationToken);
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(VehicleModelDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<VehicleModelDto>> GetById(int id, CancellationToken cancellationToken)
    {
        var model = await _db.VehicleModels.AsNoTracking()
            .Where(m => m.Id == id)
            .Select(m => new VehicleModelDto(m.Id, m.ModelName, m.VehicleBrandId))
            .SingleOrDefaultAsync(cancellationToken);

        return model is null ? NotFound() : Ok(model);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(VehicleModelDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<VehicleModelDto>> Create(
        VehicleModelRequest request, CancellationToken cancellationToken)
    {
        if (!await BrandExists(request.VehicleBrandId, cancellationToken))
        {
            ModelState.AddModelError(nameof(request.VehicleBrandId), "The vehicle brand does not exist.");
            return ValidationProblem(ModelState);
        }

        var model = new VehicleModel
        {
            ModelName = request.ModelName.Trim(),
            VehicleBrandId = request.VehicleBrandId
        };
        _db.VehicleModels.Add(model);

        var error = await Save(cancellationToken);
        if (error is not null) return error;

        var dto = new VehicleModelDto(model.Id, model.ModelName, model.VehicleBrandId);
        return CreatedAtAction(nameof(GetById), new { id = model.Id }, dto);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(VehicleModelDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<VehicleModelDto>> Update(
        int id, VehicleModelRequest request, CancellationToken cancellationToken)
    {
        var model = await _db.VehicleModels.SingleOrDefaultAsync(m => m.Id == id, cancellationToken);
        if (model is null) return NotFound();
        if (!await BrandExists(request.VehicleBrandId, cancellationToken))
        {
            ModelState.AddModelError(nameof(request.VehicleBrandId), "The vehicle brand does not exist.");
            return ValidationProblem(ModelState);
        }

        model.ModelName = request.ModelName.Trim();
        model.VehicleBrandId = request.VehicleBrandId;
        var error = await Save(cancellationToken);
        return error is not null
            ? error
            : Ok(new VehicleModelDto(model.Id, model.ModelName, model.VehicleBrandId));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var model = await _db.VehicleModels.SingleOrDefaultAsync(m => m.Id == id, cancellationToken);
        if (model is null) return NotFound();

        _db.VehicleModels.Remove(model);
        return await Save(cancellationToken) ?? NoContent();
    }

    private Task<bool> BrandExists(int id, CancellationToken cancellationToken) =>
        _db.VehicleBrands.AnyAsync(b => b.Id == id, cancellationToken);

    private async Task<ActionResult?> Save(CancellationToken cancellationToken)
    {
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return null;
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: 2601 or 2627 })
        {
            return Problem(statusCode: 409, title: "This vehicle model already exists for the selected brand.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: 547 })
        {
            return Problem(statusCode: 409, title: "The vehicle model is still used by vehicles.");
        }
    }
}
