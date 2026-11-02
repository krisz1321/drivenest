namespace Drivenest.Api.Data.Entities
{
    // Egy mező régi és új értéke. Szerviz tételnél a mező neve "item:<típus neve>".
    // OldValue = null: új tétel, NewValue = null: törölt adat.
    public class AuditLogChange
    {
        public int Id { get; set; }

        public int AuditLogId { get; set; }

        public string Field { get; set; } = string.Empty;

        public string? OldValue { get; set; }

        public string? NewValue { get; set; }
    }
}
