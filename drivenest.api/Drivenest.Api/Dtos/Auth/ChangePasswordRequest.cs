using System.ComponentModel.DataAnnotations;

namespace Drivenest.Api.Dtos.Auth
{
    public class ChangePasswordRequest
    {
        [Required(ErrorMessage = "A jelenlegi jelszó megadása kötelező.")]
        public string CurrentPassword { get; set; } = string.Empty;

        [Required(ErrorMessage = "Az új jelszó megadása kötelező.")]
        public string NewPassword { get; set; } = string.Empty;
    }
}
