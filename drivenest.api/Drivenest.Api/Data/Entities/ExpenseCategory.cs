namespace Drivenest.Api.Data.Entities
{
    public class ExpenseCategory
    {
        public int Id { get; set; }

        public string Name { get; set; } = string.Empty;

        // null = beépített kategória, egyébként a felhasználó saját kategóriája.
        // A saját kategóriák felvétele egy későbbi feladat, most csak előkészítjük.
        public int? UserId { get; set; }

        public ApplicationUser? User { get; set; }
    }
}
