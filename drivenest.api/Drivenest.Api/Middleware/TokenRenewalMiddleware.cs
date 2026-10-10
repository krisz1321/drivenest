using Drivenest.Api.Services;

namespace Drivenest.Api.Middleware
{
    public class TokenRenewalMiddleware
    {
        public const string TokenHeader = "X-Refreshed-Token";
        public const string ExpiresAtHeader = "X-Token-Expires-At";

        private static readonly HashSet<string> ModifyingMethods = new(StringComparer.OrdinalIgnoreCase)
        {
            HttpMethods.Post, HttpMethods.Put, HttpMethods.Patch, HttpMethods.Delete
        };

        private readonly RequestDelegate _next;

        public TokenRenewalMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context, IJwtTokenService tokenService)
        {
            context.Response.OnStarting(() =>
            {
                if (ShouldRenew(context))
                {
                    var renewed = tokenService.Renew(context.User);
                    if (renewed != null)
                    {
                        context.Response.Headers[TokenHeader] = renewed.Token;
                        context.Response.Headers[ExpiresAtHeader] = renewed.ExpiresAtUtc.ToString("O");
                    }
                }

                return Task.CompletedTask;
            });

            await _next(context);
        }

        private static bool ShouldRenew(HttpContext context)
        {
            return context.User.Identity?.IsAuthenticated == true
                && ModifyingMethods.Contains(context.Request.Method)
                && context.Response.StatusCode is >= 200 and < 300;
        }
    }
}
