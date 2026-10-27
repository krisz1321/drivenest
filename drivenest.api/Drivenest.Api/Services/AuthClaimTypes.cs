using Microsoft.IdentityModel.JsonWebTokens;

namespace Drivenest.Api.Services
{
    public static class AuthClaimTypes
    {
        public const string Subject = JwtRegisteredClaimNames.Sub;

        public const string TokenId = JwtRegisteredClaimNames.Jti;

        public const string Email = JwtRegisteredClaimNames.Email;

        public const string Name = "name";

        public const string Role = "role";

        // A belépés ideje (Unix másodperc); a megújított tokenek átveszik, ebből jön a 12 órás maximum.
        public const string AuthTime = "auth_time";

        public const string SecurityStamp = "security_stamp";
    }
}
