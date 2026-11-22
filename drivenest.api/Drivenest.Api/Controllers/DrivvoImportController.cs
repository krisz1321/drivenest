using Drivenest.Api.Data;
using Drivenest.Api.Dtos.Import;
using Drivenest.Api.Extensions;
using Drivenest.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Drivenest.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/vehicles")]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
public class DrivvoImportController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly DrivvoImportService _importService;

    public DrivvoImportController(AppDbContext db, DrivvoImportService importService)
    {
        _db = db;
        _importService = importService;
    }

    [HttpPost("{vehicleId:int}/import/drivvo")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(DrivvoImportResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<DrivvoImportResultDto>> Import(int vehicleId, IFormFile file, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        if (!await _db.Vehicles.AnyAsync(v => v.Id == vehicleId && v.UserId == userId, cancellationToken)) return NotFound();

        DrivvoData data;
        try
        {
            data = await _importService.ReadAsync(file, cancellationToken);
        }
        catch (FormatException ex)
        {
            return Problem(statusCode: 400, title: ex.Message);
        }

        var result = await _importService.PrepareAsync(vehicleId, userId, data, cancellationToken);

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            await _db.UpdateCurrentKm(vehicleId, cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return Problem(statusCode: 400, title: "The file contains invalid data.");
        }

        return result;
    }

    [HttpPost("import/drivvo/preview")]
    [ProducesResponseType(typeof(DrivvoImportPreviewDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<DrivvoImportPreviewDto>> Preview(IFormFile file, CancellationToken cancellationToken)
    {
        try
        {
            return await _importService.PreviewAsync(file, cancellationToken);
        }
        catch (FormatException ex)
        {
            return Problem(statusCode: 400, title: ex.Message);
        }
    }
}
