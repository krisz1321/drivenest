namespace Drivenest.Api.Data.Entities
{
    public class ServiceCategory
    {
        public int Id { get; set; }

        public string Name { get; set; } = string.Empty;

        // null = beépített típus, egyébként a felhasználó saját típusa.
        // A saját típusok felvétele egy későbbi feladat, most csak előkészítjük (mint a kiadásoknál).
        public int? UserId { get; set; }

        public ApplicationUser? User { get; set; }
    }
}
