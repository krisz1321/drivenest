using System.ComponentModel.DataAnnotations;

namespace Drivenest.Api.Dtos.Auth
{
    public class ChangeEmailRequest
    {
        // A mező neve szándékosan Email: az IdentityValidationProblem ide képezi le a foglalt cím hibáit.
        [Required(ErrorMessage = "Az e-mail-cím megadása kötelező.")]
        [EmailAddress(ErrorMessage = "Az e-mail-cím formátuma érvénytelen.")]
        [MaxLength(256, ErrorMessage = "Az e-mail-cím legfeljebb 256 karakter lehet.")]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "A jelenlegi jelszó megadása kötelező.")]
        public string CurrentPassword { get; set; } = string.Empty;
    }
}
