namespace Drivenest.Api.Data.Entities
{
    // Egy szerviz egy tétele: egy szerviztípus és az ára.
    public class ServiceRecordItem
    {
        public int Id { get; set; }

        public int ServiceRecordId { get; set; }

        public int CategoryId { get; set; }

        public decimal Amount { get; set; }

        public ServiceRecord ServiceRecord { get; set; } = null!;

        public ServiceCategory Category { get; set; } = null!;
    }
}
