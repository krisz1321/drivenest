using System.Text;
using Drivenest.Api.Data.Entities;
using Drivenest.Api.Middleware;
using Drivenest.Api.Options;
using Drivenest.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

namespace Drivenest.Api.Extensions
{
    public static class ServiceCollectionExtensions
    {
        public const string FrontendCorsPolicy = "Frontend";

        public static IServiceCollection AddJwtAuthentication(this IServiceCollection services)
        {
            services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer();

            // A JwtOptions-ből állítjuk be, így ugyanaz a (validált) kulcs szolgál az aláírásra és az ellenőrzésre.
            services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
                .Configure<IOptions<JwtOptions>>((bearer, jwtOptions) =>
                {
                    var jwt = jwtOptions.Value;

                    bearer.MapInboundClaims = false;
                    bearer.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidIssuer = jwt.Issuer,
                        ValidateAudience = true,
                        ValidAudience = jwt.Audience,
                        ValidateLifetime = true,
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
                        ClockSkew = TimeSpan.Zero,
                        NameClaimType = AuthClaimTypes.Name,
                        RoleClaimType = AuthClaimTypes.Role
                    };

                    bearer.Events = new JwtBearerEvents
                    {
                        OnTokenValidated = ValidateSecurityStampAsync
                    };
                });

            return services;
        }

        // Jelszómódosításkor az Identity új SecurityStamp-et ad, így az összes korábbi token érvénytelenné válik.
        private static async Task ValidateSecurityStampAsync(TokenValidatedContext context)
        {
            var userManager = context.HttpContext.RequestServices.GetRequiredService<UserManager<ApplicationUser>>();

            var userId = context.Principal?.FindFirst(AuthClaimTypes.Subject)?.Value;
            var stamp = context.Principal?.FindFirst(AuthClaimTypes.SecurityStamp)?.Value;

            var user = userId == null ? null : await userManager.FindByIdAsync(userId);

            if (user == null || stamp == null || user.SecurityStamp != stamp)
            {
                context.Fail("A token már nem érvényes.");
            }
        }

        public static IServiceCollection AddFrontendCors(this IServiceCollection services, IConfiguration configuration)
        {
            var origins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();

            services.AddCors(options =>
            {
                options.AddPolicy(FrontendCorsPolicy, policy => policy
                    .WithOrigins(origins)
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .WithExposedHeaders(TokenRenewalMiddleware.TokenHeader, TokenRenewalMiddleware.ExpiresAtHeader));
            });

            return services;
        }

        public static IServiceCollection AddSwaggerWithJwt(this IServiceCollection services)
        {
            services.AddSwaggerGen(options =>
            {
                options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
                {
                    Name = "Authorization",
                    Description = "A belépéskor kapott token (a \"Bearer \" előtag nélkül).",
                    In = ParameterLocation.Header,
                    Type = SecuritySchemeType.Http,
                    Scheme = "bearer",
                    BearerFormat = "JWT"
                });

                options.AddSecurityRequirement(new OpenApiSecurityRequirement
                {
                    {
                        new OpenApiSecurityScheme
                        {
                            Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
                        },
                        Array.Empty<string>()
                    }
                });
            });

            return services;
        }
    }
}
