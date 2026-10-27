namespace Drivenest.Api.Options
{
    public class JwtOptions
    {
        public const string SectionName = "Jwt";

        public string Issuer { get; set; } = string.Empty;

        public string Audience { get; set; } = string.Empty;

        public string Key { get; set; } = string.Empty;

        public int LifetimeMinutes { get; set; } = 120;

        // A belépéstől számított abszolút maximum, ennél tovább a megújítás sem hosszabbít.
        public int MaxSessionHours { get; set; } = 12;
    }
}
