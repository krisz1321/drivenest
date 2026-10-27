namespace Drivenest.Api.Data.Entities
{
    public class Expense
    {
        public int Id { get; set; }

        public int VehicleId { get; set; }

        public int CategoryId { get; set; }

        public DateOnly Date { get; set; }

        // Kilométeróra-állás a kiadás időpontjában (kötelező, mint a Drivvóban).
        public int OdometerKm { get; set; }

        public decimal Amount { get; set; }

        // Pl. benzinkút, parkolóház neve - nem kötelező.
        public string? Location { get; set; }

        public string? Description { get; set; }

        public DateTime CreatedAt { get; set; }

        public Vehicle Vehicle { get; set; } = null!;

        public ExpenseCategory Category { get; set; } = null!;
    }
}
