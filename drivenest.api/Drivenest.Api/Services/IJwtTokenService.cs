using System.Security.Claims;
using Drivenest.Api.Data.Entities;

namespace Drivenest.Api.Services
{
    public record IssuedToken(string Token, DateTime ExpiresAtUtc);

    public interface IJwtTokenService
    {
        // Új munkamenet: az auth_time a mostani pillanat (belépés, jelszómódosítás).
        IssuedToken CreateToken(ApplicationUser user, IEnumerable<string> roles);

        // Megújítás a meglévő token claimjeiből, az auth_time megmarad.
        // Null, ha a belépéstől számított maximális idő már letelt.
        IssuedToken? Renew(ClaimsPrincipal principal);
    }
}
