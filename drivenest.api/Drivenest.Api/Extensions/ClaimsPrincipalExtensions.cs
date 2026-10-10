using System.Security.Claims;
using Drivenest.Api.Services;

namespace Drivenest.Api.Extensions
{
    public static class ClaimsPrincipalExtensions
    {
        public static int GetUserId(this ClaimsPrincipal principal)
        {
            return int.Parse(principal.FindFirstValue(AuthClaimTypes.Subject)!);
        }
    }
}
