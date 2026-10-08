using Drivenest.Api.Data;
using Drivenest.Api.Dtos;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Drivenest.Api.Controllers
{
    [ApiController]
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

        [HttpGet("service-categories")]
        public async Task<ActionResult<List<LookupDto>>> GetServiceCategories()
        {
            return await _db.ServiceCategories
                .AsNoTracking()
                .OrderBy(x => x.Id)
                .Select(x => new LookupDto(x.Id, x.Name))
                .ToListAsync();
        }

        [HttpGet("expense-categories")]
        public async Task<ActionResult<List<LookupDto>>> GetExpenseCategories()
        {
            return await _db.ExpenseCategories
                .AsNoTracking()
                .OrderBy(x => x.Id)
                .Select(x => new LookupDto(x.Id, x.Name))
                .ToListAsync();
        }
    }
}
