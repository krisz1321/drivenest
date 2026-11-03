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
[Route("api/vehicle-brands")]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
public sealed class VehicleBrandsController : ControllerBase
{
    private readonly AppDbContext _db;

    public VehicleBrandsController(AppDbContext db) => _db = db;

    [HttpGet]
    [ProducesResponseType(typeof(List<VehicleBrandDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<VehicleBrandDto>>> GetAll(CancellationToken cancellationToken)
    {
        return await _db.VehicleBrands.AsNoTracking()
            .OrderBy(b => b.BrandName)
            .Select(b => new VehicleBrandDto(b.Id, b.BrandName))
            .ToListAsync(cancellationToken);
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(VehicleBrandDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<VehicleBrandDto>> GetById(int id, CancellationToken cancellationToken)
    {
        var brand = await _db.VehicleBrands.AsNoTracking()
            .Where(b => b.Id == id)
            .Select(b => new VehicleBrandDto(b.Id, b.BrandName))
            .SingleOrDefaultAsync(cancellationToken);

        return brand is null ? NotFound() : Ok(brand);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(VehicleBrandDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<VehicleBrandDto>> Create(
        VehicleBrandRequest request, CancellationToken cancellationToken)
    {
        var brand = new VehicleBrand { BrandName = request.BrandName.Trim() };
        _db.VehicleBrands.Add(brand);

        var error = await Save(cancellationToken);
        if (error is not null) return error;

        var dto = new VehicleBrandDto(brand.Id, brand.BrandName);
        return CreatedAtAction(nameof(GetById), new { id = brand.Id }, dto);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(VehicleBrandDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<VehicleBrandDto>> Update(
        int id, VehicleBrandRequest request, CancellationToken cancellationToken)
    {
        var brand = await _db.VehicleBrands.SingleOrDefaultAsync(b => b.Id == id, cancellationToken);
        if (brand is null) return NotFound();

        brand.BrandName = request.BrandName.Trim();
        var error = await Save(cancellationToken);
        return error is not null ? error : Ok(new VehicleBrandDto(brand.Id, brand.BrandName));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var brand = await _db.VehicleBrands.SingleOrDefaultAsync(b => b.Id == id, cancellationToken);
        if (brand is null) return NotFound();

        _db.VehicleBrands.Remove(brand);
        return await Save(cancellationToken) ?? NoContent();
    }

    private async Task<ActionResult?> Save(CancellationToken cancellationToken)
    {
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return null;
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: 2601 or 2627 })
        {
            return Problem(statusCode: 409, title: "A vehicle brand with this name already exists.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: 547 })
        {
            return Problem(statusCode: 409, title: "The vehicle brand is still used by vehicle models.");
        }
    }
}

