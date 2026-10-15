using System.ComponentModel.DataAnnotations;

namespace Drivenest.Api.Dtos.Vehicles;

public class VehicleRequest : IValidatableObject
{
    [Range(1, int.MaxValue)]
    public int FuelTypeId { get; set; }

    [Required, StringLength(20)]
    public string LicensePlate { get; set; } = string.Empty;

    [StringLength(17, MinimumLength = 17)]
    [RegularExpression("^[A-Za-z0-9]{17}$")]
    public string? Vin { get; set; }

    [Required, StringLength(50)]
    public string Make { get; set; } = string.Empty;

    [Required, StringLength(50)]
    public string Model { get; set; } = string.Empty;

    [Range(1886, 2100)]
    public short? Year { get; set; }

    [Range(0, int.MaxValue)]
    public int InitialKm { get; set; }

    [Range(0, int.MaxValue)]
    public int CurrentKm { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (CurrentKm < InitialKm)
            yield return new ValidationResult("Current mileage must be at least the initial mileage.",
                new[] { nameof(CurrentKm) });
    }
}
