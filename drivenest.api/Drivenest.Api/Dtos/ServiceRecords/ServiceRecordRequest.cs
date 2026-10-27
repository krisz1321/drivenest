using System.ComponentModel.DataAnnotations;

namespace Drivenest.Api.Dtos.ServiceRecords;

public class ServiceRecordRequest : IValidatableObject
{
    public DateOnly Date { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "A category is required.")]
    public int CategoryId { get; set; }

    [Required(ErrorMessage = "The odometer reading is required.")]
    [Range(0, int.MaxValue)]
    public int? OdometerKm { get; set; }

    [MaxLength(150)]
    public string? Provider { get; set; }

    [MaxLength(2000)]
    public string? Description { get; set; }

    [Range(typeof(decimal), "0", "9999999999.99", ParseLimitsInInvariantCulture = true)]
    public decimal PartsCost { get; set; }

    [Range(typeof(decimal), "0", "9999999999.99", ParseLimitsInInvariantCulture = true)]
    public decimal LaborCost { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Date == default)
            yield return new ValidationResult("A service date is required.", new[] { nameof(Date) });
        if (decimal.Round(PartsCost, 2) != PartsCost)
            yield return new ValidationResult("The parts cost supports up to two decimal places.", new[] { nameof(PartsCost) });
        if (decimal.Round(LaborCost, 2) != LaborCost)
            yield return new ValidationResult("The labor cost supports up to two decimal places.", new[] { nameof(LaborCost) });
    }
}
