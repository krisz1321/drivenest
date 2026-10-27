using System.ComponentModel.DataAnnotations;

namespace Drivenest.Api.Dtos.Reminders;

public class ReminderRequest : IValidatableObject
{
    [Required(ErrorMessage = "A title is required.")]
    [MaxLength(150)]
    public string Title { get; set; } = string.Empty;

    // Esedékesség: dátum és/vagy km óraállás, legalább az egyik kell.
    public DateOnly? DueDate { get; set; }

    [Range(0, int.MaxValue)]
    public int? DueOdometerKm { get; set; }

    // Ismétlődés (nem kötelező): hány havonta / hány km-enként.
    [Range(1, 120)]
    public short? IntervalMonths { get; set; }

    [Range(1, int.MaxValue)]
    public int? IntervalKm { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (DueDate is null && DueOdometerKm is null)
            yield return new ValidationResult("A due date or a due odometer reading is required.",
                new[] { nameof(DueDate), nameof(DueOdometerKm) });
    }
}
