namespace Drivenest.Api.Data.Entities
{
    public class ServiceRecord
    {
        public int Id { get; set; }

        public int VehicleId { get; set; }

        public DateOnly Date { get; set; }

        public int OdometerKm { get; set; }

        public string? Provider { get; set; }

        public string? Description { get; set; }

        public DateTime CreatedAt { get; set; }

        public Vehicle Vehicle { get; set; } = null!;

        // Egy szervizhez több tétel tartozhat (pl. Olajcsere + Olajszűrő + Szervíz költség),
        // mindegyiknek saját típusa és összege van. A szerviz végösszege ezek összege.
        public List<ServiceRecordItem> Items { get; set; } = new();
    }
}
