using System.ComponentModel.DataAnnotations;

namespace Drivenest.Api.Dtos.Vehicles;

/// <summary>Vehicle data used when creating or updating a vehicle.</summary>
public class VehicleRequest : IValidatableObject
{
    /// <summary>Identifier of the fuel type.</summary>
    [Range(1, int.MaxValue)]
    public int FuelTypeId { get; set; }

    /// <summary>Vehicle license plate.</summary>
    [Required, StringLength(20)]
    public string LicensePlate { get; set; } = string.Empty;

    /// <summary>Vehicle identification number.</summary>
    [StringLength(17, MinimumLength = 17)]
    [RegularExpression("^[A-Za-z0-9]{17}$")]
    public string? Vin { get; set; }

    /// <summary>Catalog model identifier. If null, CustomMake and CustomModel are used.</summary>
    public int? VehicleModelID { get; set; }

    /// <summary>Custom vehicle brand used when VehicleModelID is null.</summary>
    [StringLength(50)]
    public string? CustomMake { get; set; }

    /// <summary>Custom vehicle model used when VehicleModelID is null.</summary>
    [StringLength(50)]
    public string? CustomModel { get; set; }

    /// <summary>Vehicle model year.</summary>
    [Range(1886, 2100)]
    public short? Year { get; set; }

    /// <summary>Odometer value when the vehicle was added.</summary>
    [Range(0, int.MaxValue)]
    public int InitialKm { get; set; }

    /// <summary>Current odometer value.</summary>
    [Range(0, int.MaxValue)]
    public int CurrentKm { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (VehicleModelID is null && (string.IsNullOrWhiteSpace(CustomMake) || string.IsNullOrWhiteSpace(CustomModel)))
            yield return new ValidationResult("A vehicle model or both custom make and model are required.",
                new[] { nameof(VehicleModelID), nameof(CustomMake), nameof(CustomModel) });

        if (CurrentKm < InitialKm)
            yield return new ValidationResult("Current mileage must be at least the initial mileage.",
                new[] { nameof(CurrentKm) });
    }
}
