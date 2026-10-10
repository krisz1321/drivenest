using Drivenest.Api.Data;
using Drivenest.Api.Data.Entities;
using Drivenest.Api.Extensions;
using Drivenest.Api.Options;
using Drivenest.Api.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Drivenest.Api
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            builder.Services.AddDbContext<AppDbContext>(options =>
                options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

            builder.Services.AddIdentityCore<ApplicationUser>(options =>
                {
                    options.Password.RequiredLength = 8;
                    options.Password.RequireDigit = true;
                    options.Password.RequireLowercase = true;
                    options.Password.RequireUppercase = true;
                    options.Password.RequireNonAlphanumeric = false;

                    options.User.RequireUniqueEmail = true;

                    options.Lockout.AllowedForNewUsers = true;
                    options.Lockout.MaxFailedAccessAttempts = 5;
                    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
                })
                .AddRoles<IdentityRole<int>>()
                .AddErrorDescriber<HungarianIdentityErrorDescriber>()
                .AddEntityFrameworkStores<AppDbContext>();

            builder.Services.AddOptions<JwtOptions>()
                .Bind(builder.Configuration.GetSection(JwtOptions.SectionName))
                .Validate(o => o.Key.Length >= 32,
                    "A Jwt:Key hiányzik vagy rövidebb 32 karakternél (dotnet user-secrets set \"Jwt:Key\" \"...\").")
                .Validate(o => o.LifetimeMinutes > 0, "A Jwt:LifetimeMinutes legyen pozitív.")
                .Validate(o => o.MaxSessionHours * 60 >= o.LifetimeMinutes,
                    "A Jwt:MaxSessionHours nem lehet rövidebb a Jwt:LifetimeMinutes-nél.")
                .ValidateOnStart();

            builder.Services.AddSingleton(TimeProvider.System);
            builder.Services.AddSingleton<IJwtTokenService, JwtTokenService>();

            builder.Services.AddJwtAuthentication();
            builder.Services.AddFrontendCors(builder.Configuration);

            builder.Services.AddControllers();
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerWithJwt();

            var app = builder.Build();

            if (app.Environment.IsDevelopment())
            {
                using (var scope = app.Services.CreateScope())
                {
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    db.Database.Migrate();

                    await DevelopmentDataSeeder.SeedAsync(scope.ServiceProvider);
                }

                app.UseSwagger();
                app.UseSwaggerUI();
            }

            app.UseHttpsRedirection();
            app.UseCors(ServiceCollectionExtensions.FrontendCorsPolicy);
            app.UseAuthentication();
            app.UseAuthorization();
            app.MapControllers();

            await app.RunAsync();
        }
    }
}
