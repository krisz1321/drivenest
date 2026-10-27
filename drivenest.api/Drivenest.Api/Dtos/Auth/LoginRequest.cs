using System.ComponentModel.DataAnnotations;

namespace Drivenest.Api.Dtos.Auth
{
    public class LoginRequest
    {
        [Required(ErrorMessage = "A felhasználónév vagy e-mail-cím megadása kötelező.")]
        public string UserNameOrEmail { get; set; } = string.Empty;

        [Required(ErrorMessage = "A jelszó megadása kötelező.")]
        public string Password { get; set; } = string.Empty;
    }
}
