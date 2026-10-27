using System.ComponentModel.DataAnnotations;
using Drivenest.Api.Data.Entities;

namespace Drivenest.Api.Dtos.Me
{
    public class UpdateProfileRequest
    {
        [Required(ErrorMessage = "A név megadása kötelező.")]
        [MaxLength(100, ErrorMessage = "A név legfeljebb 100 karakter lehet.")]
        public string DisplayName { get; set; } = string.Empty;

        [Required(ErrorMessage = "A pénznem megadása kötelező.")]
        [AllowedValues(UserPreferences.Huf, UserPreferences.Eur, ErrorMessage = "A pénznem csak HUF vagy EUR lehet.")]
        public string Currency { get; set; } = string.Empty;

        [Required(ErrorMessage = "A távolság mértékegységének megadása kötelező.")]
        [AllowedValues(UserPreferences.Km, UserPreferences.Mi, ErrorMessage = "A távolság mértékegysége csak km vagy mi lehet.")]
        public string DistanceUnit { get; set; } = string.Empty;

        [Required(ErrorMessage = "A térfogat mértékegységének megadása kötelező.")]
        [AllowedValues(UserPreferences.Liter, UserPreferences.Gallon, ErrorMessage = "A térfogat mértékegysége csak l vagy gal lehet.")]
        public string VolumeUnit { get; set; } = string.Empty;

        [Required(ErrorMessage = "A fogyasztás mértékegységének megadása kötelező.")]
        [AllowedValues(UserPreferences.LitersPer100Km, UserPreferences.KmPerLiter, UserPreferences.Mpg,
            ErrorMessage = "A fogyasztás mértékegysége csak l/100km, km/l vagy mpg lehet.")]
        public string ConsumptionUnit { get; set; } = string.Empty;
    }
}
