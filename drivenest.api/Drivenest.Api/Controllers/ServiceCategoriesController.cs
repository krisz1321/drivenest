using Drivenest.Api.Data;
using Drivenest.Api.Dtos.ServiceRecords;
using Drivenest.Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace Drivenest.Api.Controllers;

// Most csak listáz, ugyanúgy, mint az ExpenseCategoriesController. A saját típusok felvétele később jön.
[ApiController]
[Authorize]
[Route("api/service-categories")]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
public class ServiceCategoriesController : ControllerBase
{
    private readonly AppDbContext _db;

    public ServiceCategoriesController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    [ProducesResponseType(typeof(List<ServiceCategoryDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<ServiceCategoryDto>>> GetAll(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();

        var categories = await _db.ServiceCategories.AsNoTracking()
            .Where(c => c.UserId == null || c.UserId == userId)
            .Select(c => new ServiceCategoryDto(c.Id, c.Name, c.UserId != null))
            .ToListAsync(cancellationToken);

        // Előbb a beépítettek, utána a saját típusok, mindkettő magyar ábécérendben.
        var hungarian = StringComparer.Create(new CultureInfo("hu-HU"), ignoreCase: true);
        return categories
            .OrderBy(c => c.IsCustom)
            .ThenBy(c => c.Name, hungarian)
            .ToList();
    }
}
