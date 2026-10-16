namespace Drivenest.Api.Data.Entities
{
    // A felhasználói beállítások megengedett értékei. A CHECK megkötések és a DTO validáció is ezt használja.
    public static class UserPreferences
    {
        public const string Huf = "HUF";
        public const string Eur = "EUR";

        public const string Km = "km";
        public const string Mi = "mi";

        public const string Liter = "l";
        public const string Gallon = "gal";

        public const string LitersPer100Km = "l/100km";
        public const string KmPerLiter = "km/l";
        public const string Mpg = "mpg";
    }
}
