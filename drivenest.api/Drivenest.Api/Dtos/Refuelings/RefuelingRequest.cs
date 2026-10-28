using System.ComponentModel.DataAnnotations;

namespace Drivenest.Api.Dtos.Refuelings;

public class RefuelingRequest : IValidatableObject
{
    public DateOnly Date { get; set; }

    public TimeOnly? Time { get; set; }

    [Range(0, int.MaxValue)]
    public int OdometerKm { get; set; }

    [Range(typeof(decimal), "0.001", "999999.999", ParseLimitsInInvariantCulture = true)]
    public decimal Liters { get; set; }

    [Range(typeof(decimal), "0", "9999999999.99", ParseLimitsInInvariantCulture = true)]
    public decimal TotalAmount { get; set; }

    public bool IsFullTank { get; set; } = true;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Date == default)
            yield return new ValidationResult("A refueling date is required.", new[] { nameof(Date) });
        if (decimal.Round(Liters, 3) != Liters)
            yield return new ValidationResult("Liters supports up to three decimal places.", new[] { nameof(Liters) });
        if (decimal.Round(TotalAmount, 2) != TotalAmount)
            yield return new ValidationResult("The total amount supports up to two decimal places.", new[] { nameof(TotalAmount) });
    }
}
