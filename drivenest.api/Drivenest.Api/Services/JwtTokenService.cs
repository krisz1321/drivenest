using System.Globalization;
using System.Security.Claims;
using System.Text;
using Drivenest.Api.Data.Entities;
using Drivenest.Api.Options;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Drivenest.Api.Services
{
    public class JwtTokenService : IJwtTokenService
    {
        private readonly JwtOptions _options;
        private readonly TimeProvider _timeProvider;
        private readonly SigningCredentials _credentials;
        private readonly JsonWebTokenHandler _handler = new();

        public JwtTokenService(IOptions<JwtOptions> options, TimeProvider timeProvider)
        {
            _options = options.Value;
            _timeProvider = timeProvider;
            _credentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Key)),
                SecurityAlgorithms.HmacSha256);
        }

        public IssuedToken CreateToken(ApplicationUser user, IEnumerable<string> roles)
        {
            var now = _timeProvider.GetUtcNow();

            return Build(
                user.Id.ToString(CultureInfo.InvariantCulture),
                user.Email ?? string.Empty,
                user.DisplayName,
                user.SecurityStamp ?? string.Empty,
                roles,
                authTime: now,
                now);
        }

        public IssuedToken? Renew(ClaimsPrincipal principal)
        {
            var subject = principal.FindFirstValue(AuthClaimTypes.Subject);
            var authTimeValue = principal.FindFirstValue(AuthClaimTypes.AuthTime);

            if (subject == null || !long.TryParse(authTimeValue, CultureInfo.InvariantCulture, out var authTimeSeconds))
            {
                return null;
            }

            var now = _timeProvider.GetUtcNow();
            var authTime = DateTimeOffset.FromUnixTimeSeconds(authTimeSeconds);

            if (now >= authTime.AddHours(_options.MaxSessionHours))
            {
                return null;
            }

            return Build(
                subject,
                principal.FindFirstValue(AuthClaimTypes.Email) ?? string.Empty,
                principal.FindFirstValue(AuthClaimTypes.Name) ?? string.Empty,
                principal.FindFirstValue(AuthClaimTypes.SecurityStamp) ?? string.Empty,
                principal.FindAll(AuthClaimTypes.Role).Select(c => c.Value),
                authTime,
                now);
        }

        private IssuedToken Build(string subject, string email, string displayName, string securityStamp,
            IEnumerable<string> roles, DateTimeOffset authTime, DateTimeOffset now)
        {
            // A lejárat sosem lehet későbbi, mint a belépés + maximális munkamenet-idő.
            var expires = Min(now.AddMinutes(_options.LifetimeMinutes), authTime.AddHours(_options.MaxSessionHours));

            var identity = new ClaimsIdentity();
            identity.AddClaim(new Claim(AuthClaimTypes.Subject, subject));
            identity.AddClaim(new Claim(AuthClaimTypes.TokenId, Guid.NewGuid().ToString()));
            identity.AddClaim(new Claim(AuthClaimTypes.Email, email));
            identity.AddClaim(new Claim(AuthClaimTypes.Name, displayName));
            identity.AddClaim(new Claim(AuthClaimTypes.SecurityStamp, securityStamp));
            identity.AddClaim(new Claim(AuthClaimTypes.AuthTime,
                authTime.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture), ClaimValueTypes.Integer64));

            foreach (var role in roles)
            {
                identity.AddClaim(new Claim(AuthClaimTypes.Role, role));
            }

            var descriptor = new SecurityTokenDescriptor
            {
                Subject = identity,
                Issuer = _options.Issuer,
                Audience = _options.Audience,
                IssuedAt = now.UtcDateTime,
                NotBefore = now.UtcDateTime,
                Expires = expires.UtcDateTime,
                SigningCredentials = _credentials
            };

            return new IssuedToken(_handler.CreateToken(descriptor), expires.UtcDateTime);
        }

        private static DateTimeOffset Min(DateTimeOffset a, DateTimeOffset b)
        {
            return a <= b ? a : b;
        }
    }
}
