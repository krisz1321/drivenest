using System.ComponentModel.DataAnnotations;

namespace Drivenest.Api.Dtos.ServiceRecords;

public class ServiceRecordRequest : IValidatableObject
{
    public DateOnly Date { get; set; }

    // Nullable, hogy a [Required] tényleg jelezzen, ha a km kimarad a kérésből.
    [Required(ErrorMessage = "The odometer reading is required.")]
    [Range(0, int.MaxValue)]
    public int? OdometerKm { get; set; }

    // A szerviz / műhely neve vagy helyszíne - nem kötelező.
    [MaxLength(150)]
    public string? Provider { get; set; }

    [MaxLength(2000)]
    public string? Description { get; set; }

    // A szerviz tételei: típusonként egy összeg. Legalább egy kell.
    [MaxLength(50)]
    public List<ServiceRecordItemRequest> Items { get; set; } = new();

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Date == default)
            yield return new ValidationResult("A service date is required.", new[] { nameof(Date) });
        if (Items.Count == 0)
            yield return new ValidationResult("At least one service type is required.", new[] { nameof(Items) });
        if (Items.Select(i => i.CategoryId).Distinct().Count() != Items.Count)
            yield return new ValidationResult("A service type can only be added once.", new[] { nameof(Items) });
    }
}

public class ServiceRecordItemRequest : IValidatableObject
{
    [Range(1, int.MaxValue, ErrorMessage = "A service type is required.")]
    public int CategoryId { get; set; }

    [Range(typeof(decimal), "0", "9999999999.99", ParseLimitsInInvariantCulture = true)]
    public decimal Amount { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (decimal.Round(Amount, 2) != Amount)
            yield return new ValidationResult("The amount supports up to two decimal places.", new[] { nameof(Amount) });
    }
}
