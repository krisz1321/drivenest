using System.ComponentModel.DataAnnotations;

namespace Drivenest.Api.Dtos.Auth
{
    public class RegisterRequest
    {
        [Required(ErrorMessage = "Az e-mail-cím megadása kötelező.")]
        [EmailAddress(ErrorMessage = "Az e-mail-cím formátuma érvénytelen.")]
        [MaxLength(256, ErrorMessage = "Az e-mail-cím legfeljebb 256 karakter lehet.")]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "A jelszó megadása kötelező.")]
        public string Password { get; set; } = string.Empty;

        [Required(ErrorMessage = "A név megadása kötelező.")]
        [MaxLength(100, ErrorMessage = "A név legfeljebb 100 karakter lehet.")]
        public string DisplayName { get; set; } = string.Empty;
    }
}
