namespace Drivenest.Api.Data.Entities
{
    public class Refueling
    {
        public int Id { get; set; }

        public int VehicleId { get; set; }

        public DateOnly Date { get; set; }

        public int OdometerKm { get; set; }

        public decimal Liters { get; set; }

        public decimal TotalAmount { get; set; }

        public bool IsFullTank { get; set; } = true;

        public DateTime CreatedAt { get; set; }

        public Vehicle Vehicle { get; set; } = null!;
    }
}
