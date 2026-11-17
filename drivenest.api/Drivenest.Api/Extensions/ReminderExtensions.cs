using Drivenest.Api.Data.Entities;

namespace Drivenest.Api.Extensions;

public static class ReminderExtensions
{
    public static bool TryComplete(this Reminder reminder, DateOnly date, int odometerKm)
    {
        if (reminder.IntervalMonths is null && reminder.IntervalKm is null)
        {
            reminder.IsCompleted = true;
            return true;
        }

        try
        {
            DateOnly? dueDate = reminder.IntervalMonths is { } months ? date.AddMonths(months) : null;
            int? dueKm = reminder.IntervalKm is { } km ? checked(odometerKm + km) : null;
            reminder.DueDate = dueDate;
            reminder.DueOdometerKm = dueKm;
            return true;
        }
        catch (Exception ex) when (ex is ArgumentOutOfRangeException or OverflowException)
        {
            return false;
        }
    }
}
