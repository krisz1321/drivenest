using Microsoft.AspNetCore.Identity;

namespace Drivenest.Api.Data.Entities
{
    public class ApplicationUser : IdentityUser<int>
    {
        public string DisplayName { get; set; } = string.Empty;

        public string Currency { get; set; } = "HUF";
    }
}
