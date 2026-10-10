using Drivenest.Api.Data.Entities;
using Drivenest.Api.Dtos.Auth;
using Drivenest.Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Drivenest.Api.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/me")]
    public class MeController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;

        public MeController(UserManager<ApplicationUser> userManager)
        {
            _userManager = userManager;
        }

        [HttpGet]
        public async Task<ActionResult<UserDto>> Get()
        {
            var user = await _userManager.FindByIdAsync(User.GetUserId().ToString());
            if (user == null)
            {
                return Unauthorized();
            }

            return new UserDto(user.Id, user.Email ?? string.Empty, user.DisplayName, user.Currency);
        }
    }
}
