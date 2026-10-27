namespace Drivenest.Api.Dtos.Reminders;

public record ReminderDto(int Id, int VehicleId, string Title, DateOnly? DueDate, int? DueOdometerKm,
    short? IntervalMonths, int? IntervalKm);
