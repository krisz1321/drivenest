namespace Drivenest.Api.Data.Entities
{
    public class ServiceRecord
    {
        public int Id { get; set; }

        public int VehicleId { get; set; }

        public int CategoryId { get; set; }

        public DateOnly Date { get; set; }

        public int OdometerKm { get; set; }

        public string? Provider { get; set; }

        public string? Description { get; set; }

        // Egy bejegyzés = egy szerviztípus egy összeggel.
        // A munkadíjat külön bejegyzésként lehet felvenni, a saját kategóriájával.
        public decimal Amount { get; set; }

        public DateTime CreatedAt { get; set; }

        public Vehicle Vehicle { get; set; } = null!;

        public ServiceCategory Category { get; set; } = null!;
    }
}
