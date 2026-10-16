using Drivenest.Api.Data.Entities;
using Drivenest.Api.Dtos.Auth;
using Drivenest.Api.Dtos.Me;
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

            return UserDto.From(user);
        }

        // A SecurityStamp nem változik, ezért a jelenlegi token érvényes marad.
        [HttpPut]
        public async Task<ActionResult<UserDto>> Update(UpdateProfileRequest request)
        {
            var user = await _userManager.FindByIdAsync(User.GetUserId().ToString());
            if (user == null)
            {
                return Unauthorized();
            }

            user.DisplayName = request.DisplayName.Trim();
            user.Currency = request.Currency;
            user.DistanceUnit = request.DistanceUnit;
            user.VolumeUnit = request.VolumeUnit;
            user.ConsumptionUnit = request.ConsumptionUnit;

            var result = await _userManager.UpdateAsync(user);
            if (!result.Succeeded)
            {
                foreach (var error in result.Errors)
                {
                    ModelState.AddModelError(string.Empty, error.Description);
                }

                return ValidationProblem(ModelState);
            }

            return UserDto.From(user);
        }
    }
}
