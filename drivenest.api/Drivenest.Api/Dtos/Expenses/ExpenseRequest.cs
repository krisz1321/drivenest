using System.ComponentModel.DataAnnotations;

namespace Drivenest.Api.Dtos.Expenses;

public class ExpenseRequest : IValidatableObject
{
    public DateOnly Date { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "A category is required.")]
    public int CategoryId { get; set; }

    // Nullable, hogy a [Required] tényleg jelezzen, ha a km kimarad a kérésből.
    [Required(ErrorMessage = "The odometer reading is required.")]
    [Range(0, int.MaxValue)]
    public int? OdometerKm { get; set; }

    [Range(typeof(decimal), "0", "9999999999.99", ParseLimitsInInvariantCulture = true)]
    public decimal Amount { get; set; }

    [MaxLength(200)]
    public string? Location { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Date == default)
            yield return new ValidationResult("An expense date is required.", new[] { nameof(Date) });
        if (decimal.Round(Amount, 2) != Amount)
            yield return new ValidationResult("The amount supports up to two decimal places.", new[] { nameof(Amount) });
    }
}
