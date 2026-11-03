namespace Drivenest.Api.Data.Entities
{
    public class VehicleBrand
    {
        public int Id { get; set; }

        public string BrandName { get; set; } = string.Empty;

        public ICollection<VehicleModel> Models { get; set; } = new List<VehicleModel>();
    }
}
