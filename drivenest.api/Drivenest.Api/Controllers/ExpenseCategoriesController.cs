using Drivenest.Api.Data;
using Drivenest.Api.Dtos.Expenses;
using Drivenest.Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace Drivenest.Api.Controllers;

// Most csak listáz. A saját kategóriák felvétele / törlése (POST, PUT, DELETE) később ide kerül.
[ApiController]
[Authorize]
[Route("api/expense-categories")]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
public class ExpenseCategoriesController : ControllerBase
{
    private readonly AppDbContext _db;

    public ExpenseCategoriesController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    [ProducesResponseType(typeof(List<ExpenseCategoryDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<ExpenseCategoryDto>>> GetAll(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();

        var categories = await _db.ExpenseCategories.AsNoTracking()
            .Where(c => c.UserId == null || c.UserId == userId)
            .Select(c => new ExpenseCategoryDto(c.Id, c.Name, c.UserId != null))
            .ToListAsync(cancellationToken);

        // Előbb a beépítettek, utána a saját kategóriák, mindkettő ábécérendben (magyar szabályok szerint, mint a Drivvo-ban).
        var hungarian = StringComparer.Create(new CultureInfo("hu-HU"), ignoreCase: true);
        return categories
            .OrderBy(c => c.IsCustom)
            .ThenBy(c => c.Name, hungarian)
            .ToList();
    }
}
