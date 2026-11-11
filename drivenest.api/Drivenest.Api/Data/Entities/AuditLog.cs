namespace Drivenest.Api.Data.Entities
{
    // Egy módosítás vagy törlés nyoma. A bejegyzés adatairól másolatot tárol, mert törlés után
    // az eredeti sor már nincs meg, ezért a bejegyzésre és a járműre nincs idegen kulcs.
    public class AuditLog
    {
        public int Id { get; set; }

        public int UserId { get; set; }

        public string Action { get; set; } = string.Empty;

        public string EntityType { get; set; } = string.Empty;

        public int EntityId { get; set; }

        public int VehicleId { get; set; }

        public string LicensePlate { get; set; } = string.Empty;

        public string VehicleName { get; set; } = string.Empty;

        public DateOnly? Date { get; set; }

        // A bejegyzés létrehozásának ideje: a járműnek nincs dátuma, ehhez mérjük a 7 napot.
        public DateTime? EntityCreatedAt { get; set; }

        public string? Summary { get; set; }

        public decimal? Amount { get; set; }

        public decimal? Liters { get; set; }

        // A bejegyzés ImportSource értékének másolata.
        public string? ImportSource { get; set; }

        public DateTime CreatedAt { get; set; }

        public ApplicationUser User { get; set; } = null!;

        public List<AuditLogChange> Changes { get; set; } = new();
    }
}
