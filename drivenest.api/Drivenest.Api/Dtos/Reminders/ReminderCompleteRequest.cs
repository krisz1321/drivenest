using System.ComponentModel.DataAnnotations;

namespace Drivenest.Api.Dtos.Reminders;

public class ReminderCompleteRequest
{
    [MinLength(8), MaxLength(8)]
    public byte[]? RowVersion { get; set; }
}
