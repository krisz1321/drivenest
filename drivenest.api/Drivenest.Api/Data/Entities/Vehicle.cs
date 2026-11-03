using System.ComponentModel.DataAnnotations.Schema;

namespace Drivenest.Api.Data.Entities
{
    public class Vehicle
    {
        public int Id { get; set; }

        public int UserId { get; set; }

        public int FuelTypeId { get; set; }

        public string LicensePlate { get; set; } = string.Empty;

        public string? Vin { get; set; }

        public int? VehicleModelID { get; set; }

        public string CustomMake { get; set; } = string.Empty;
        public string CustomModel { get; set; } = string.Empty;

        public short? Year { get; set; }

        public int InitialKm { get; set; }

        public int CurrentKm { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime? UpdatedAt { get; set; }

        public ApplicationUser User { get; set; } = null!;

        public FuelType FuelType { get; set; } = null!;

        public VehicleModel? VehicleModel { get; set; }

        [NotMapped]
        public string Make => VehicleModel?.VehicleBrand?.BrandName ?? CustomMake;

        [NotMapped]
        public string Model => VehicleModel?.ModelName ?? CustomModel;
    }
}
