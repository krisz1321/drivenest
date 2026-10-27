using Microsoft.AspNetCore.Identity;

namespace Drivenest.Api.Data.Entities
{
    public class ApplicationUser : IdentityUser<int>
    {
        public string DisplayName { get; set; } = string.Empty;

        public string Currency { get; set; } = UserPreferences.Huf;

        public string DistanceUnit { get; set; } = UserPreferences.Km;

        public string VolumeUnit { get; set; } = UserPreferences.Liter;

        public string ConsumptionUnit { get; set; } = UserPreferences.LitersPer100Km;
    }
}
