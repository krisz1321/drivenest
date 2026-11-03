namespace Drivenest.Api.Data.Entities
{
    public class VehicleModel
    {
        public int Id { get; set; }

        public string ModelName { get; set; } = string.Empty;

        public int VehicleBrandId { get; set; }

        public VehicleBrand VehicleBrand { get; set; } = null!;

        public ICollection<Vehicle> Vehicles { get; set; } = new List<Vehicle>();
    }
}
