namespace Drivenest.Api.Data.Entities
{
    public class Vehicle
    {
        public int Id { get; set; }

        public int UserId { get; set; }

        public int FuelTypeId { get; set; }

        public string LicensePlate { get; set; } = string.Empty;

        public string? Vin { get; set; }

        public string Make { get; set; } = string.Empty;

        public string Model { get; set; } = string.Empty;

        public short? Year { get; set; }

        public int InitialKm { get; set; }

        public int CurrentKm { get; set; }

        public ApplicationUser User { get; set; } = null!;

        public FuelType FuelType { get; set; } = null!;
    }
}
