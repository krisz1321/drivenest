using Drivenest.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Drivenest.Api.Controllers
{
    // IDEIGLENES: csak a teszteléshez van itt, az auth (S1-05) után ki kell törölni.
    [ApiController]
    [Route("api/dev")]
    public class DevController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IWebHostEnvironment _environment;

        public DevController(AppDbContext db, IWebHostEnvironment environment)
        {
            _db = db;
            _environment = environment;
        }

        [HttpGet("users")]
        public async Task<ActionResult<List<string>>> GetUserNames()
        {
            if (!_environment.IsDevelopment())
            {
                return NotFound();
            }

            return await _db.Users
                .AsNoTracking()
                .OrderBy(u => u.Id)
                .Select(u => u.DisplayName)
                .ToListAsync();
        }
    }
}
