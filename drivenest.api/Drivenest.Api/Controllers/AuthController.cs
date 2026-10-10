using Drivenest.Api.Data.Entities;
using Drivenest.Api.Dtos.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Drivenest.Api.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private const string UserRole = "User";

        private readonly UserManager<ApplicationUser> _userManager;

        public AuthController(UserManager<ApplicationUser> userManager)
        {
            _userManager = userManager;
        }

        [HttpPost("register")]
        public async Task<ActionResult<UserDto>> Register(RegisterRequest request)
        {
            var email = request.Email.Trim();

            var user = new ApplicationUser
            {
                UserName = email,
                Email = email,
                DisplayName = request.DisplayName.Trim(),
                Currency = "HUF"
            };

            var createResult = await _userManager.CreateAsync(user, request.Password);
            if (!createResult.Succeeded)
            {
                return IdentityValidationProblem(createResult);
            }

            var roleResult = await _userManager.AddToRoleAsync(user, UserRole);
            if (!roleResult.Succeeded)
            {
                // Szerepkör nélküli fiók ne maradjon az adatbázisban.
                await _userManager.DeleteAsync(user);

                return IdentityValidationProblem(roleResult);
            }

            var dto = new UserDto(user.Id, user.Email, user.DisplayName, user.Currency);

            return StatusCode(StatusCodes.Status201Created, dto);
        }

        private ActionResult IdentityValidationProblem(IdentityResult result)
        {
            // A felhasználónév az e-mail-cím, ezért a foglaltságot elég egyszer jelezni.
            var errors = result.Errors.Any(e => e.Code == nameof(IdentityErrorDescriber.DuplicateEmail))
                ? result.Errors.Where(e => e.Code != nameof(IdentityErrorDescriber.DuplicateUserName))
                : result.Errors;

            foreach (var error in errors)
            {
                ModelState.AddModelError(GetFieldName(error.Code), error.Description);
            }

            return ValidationProblem(ModelState);
        }

        private static string GetFieldName(string errorCode)
        {
            if (errorCode.Contains("Email") || errorCode.Contains("UserName"))
            {
                return nameof(RegisterRequest.Email);
            }

            if (errorCode.StartsWith("Password"))
            {
                return nameof(RegisterRequest.Password);
            }

            return string.Empty;
        }
    }
}
