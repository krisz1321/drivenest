using Drivenest.Api.Data.Entities;
using Drivenest.Api.Dtos.Auth;
using Drivenest.Api.Extensions;
using Drivenest.Api.Middleware;
using Drivenest.Api.Services;
using Microsoft.AspNetCore.Authorization;
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
        private readonly IJwtTokenService _tokenService;

        public AuthController(UserManager<ApplicationUser> userManager, IJwtTokenService tokenService)
        {
            _userManager = userManager;
            _tokenService = tokenService;
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

        [HttpPost("login")]
        public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
        {
            var login = request.UserNameOrEmail.Trim();

            var user = await _userManager.FindByNameAsync(login)
                ?? await _userManager.FindByEmailAsync(login);

            // Minden hibás esetben ugyanaz a válasz, hogy ne derüljön ki, létezik-e a felhasználó vagy zárolt-e.
            if (user == null || await _userManager.IsLockedOutAsync(user))
            {
                return InvalidCredentials();
            }

            if (!await _userManager.CheckPasswordAsync(user, request.Password))
            {
                await _userManager.AccessFailedAsync(user);

                return InvalidCredentials();
            }

            await _userManager.ResetAccessFailedCountAsync(user);

            return await CreateLoginResponseAsync(user);
        }

        // A jelszócsere után az Identity új SecurityStamp-et ad, ezért itt új tokent adunk, a régiek érvénytelenek.
        [HttpPost("change-password")]
        [Authorize]
        [SkipTokenRenewal]
        public async Task<ActionResult<LoginResponse>> ChangePassword(ChangePasswordRequest request)
        {
            var user = await _userManager.FindByIdAsync(User.GetUserId().ToString());
            if (user == null)
            {
                return Unauthorized();
            }

            if (request.NewPassword == request.CurrentPassword)
            {
                ModelState.AddModelError(nameof(ChangePasswordRequest.NewPassword),
                    "Az új jelszó nem egyezhet meg a jelenlegivel.");

                return ValidationProblem(ModelState);
            }

            var result = await _userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
            if (!result.Succeeded)
            {
                return IdentityValidationProblem(result, nameof(ChangePasswordRequest.NewPassword));
            }

            return await CreateLoginResponseAsync(user);
        }

        private async Task<LoginResponse> CreateLoginResponseAsync(ApplicationUser user)
        {
            var roles = (await _userManager.GetRolesAsync(user)).ToList();
            var token = _tokenService.CreateToken(user, roles);

            var dto = new UserDto(user.Id, user.Email ?? string.Empty, user.DisplayName, user.Currency);

            return new LoginResponse(token.Token, token.ExpiresAtUtc, dto, roles);
        }

        private ActionResult InvalidCredentials()
        {
            return Problem(
                statusCode: StatusCodes.Status401Unauthorized,
                title: "Hibás felhasználónév vagy jelszó.");
        }

        private ActionResult IdentityValidationProblem(IdentityResult result,
            string passwordField = nameof(RegisterRequest.Password))
        {
            // A felhasználónév az e-mail-cím, ezért a foglaltságot elég egyszer jelezni.
            var errors = result.Errors.Any(e => e.Code == nameof(IdentityErrorDescriber.DuplicateEmail))
                ? result.Errors.Where(e => e.Code != nameof(IdentityErrorDescriber.DuplicateUserName))
                : result.Errors;

            foreach (var error in errors)
            {
                ModelState.AddModelError(GetFieldName(error.Code, passwordField), error.Description);
            }

            return ValidationProblem(ModelState);
        }

        private static string GetFieldName(string errorCode, string passwordField)
        {
            if (errorCode.Contains("Email") || errorCode.Contains("UserName"))
            {
                return nameof(RegisterRequest.Email);
            }

            if (errorCode == nameof(IdentityErrorDescriber.PasswordMismatch))
            {
                return nameof(ChangePasswordRequest.CurrentPassword);
            }

            if (errorCode.StartsWith("Password"))
            {
                return passwordField;
            }

            return string.Empty;
        }
    }
}
