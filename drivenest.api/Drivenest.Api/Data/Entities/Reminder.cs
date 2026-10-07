namespace Drivenest.Api.Data.Entities
{
    public class Reminder
    {
        public int Id { get; set; }

        public int VehicleId { get; set; }

        public string Title { get; set; } = string.Empty;

        public DateOnly? DueDate { get; set; }

        public int? DueOdometerKm { get; set; }

        public short? IntervalMonths { get; set; }

        public int? IntervalKm { get; set; }

        public Vehicle Vehicle { get; set; } = null!;
    }
}
