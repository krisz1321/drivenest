using Drivenest.Api.Data;
using Drivenest.Api.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Drivenest.Api.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/lookups")]
    public class LookupsController : ControllerBase
    {
        private readonly AppDbContext _db;

        public LookupsController(AppDbContext db)
        {
            _db = db;
        }

        [HttpGet("fuel-types")]
        public async Task<ActionResult<List<LookupDto>>> GetFuelTypes()
        {
            return await _db.FuelTypes
                .AsNoTracking()
                .OrderBy(x => x.Id)
                .Select(x => new LookupDto(x.Id, x.Name))
                .ToListAsync();
        }

        // A kiadás- és szerviztípusok külön végponton vannak:
        // api/expense-categories (ExpenseCategoriesController), api/service-categories (ServiceCategoriesController).
    }
}
