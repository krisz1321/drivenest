using Drivenest.Api.Data;
using Drivenest.Api.Dtos.Expenses;
using Drivenest.Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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

        // Előbb a beépítettek, utána a saját kategóriák.
        return await _db.ExpenseCategories.AsNoTracking()
            .Where(c => c.UserId == null || c.UserId == userId)
            .OrderBy(c => c.UserId != null).ThenBy(c => c.Id)
            .Select(c => new ExpenseCategoryDto(c.Id, c.Name, c.UserId != null))
            .ToListAsync(cancellationToken);
    }
}
