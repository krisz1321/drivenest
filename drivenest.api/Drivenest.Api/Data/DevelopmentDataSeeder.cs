using Drivenest.Api.Data.Entities;
using Microsoft.AspNetCore.Identity;

namespace Drivenest.Api.Data
{
    // Csak fejlesztői környezetben fut: demó felhasználók és adatok, hogy ne üres adatbázison dolgozzunk.
    public static class DevelopmentDataSeeder
    {
        private const string DemoUserName = "demo1";
        private const string DemoPassword = "Demo123!";

        public static async Task SeedAsync(IServiceProvider services)
        {
            var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();

            if (await userManager.FindByNameAsync(DemoUserName) != null)
            {
                return;
            }

            await CreateDemoUserAsync(userManager);
        }

        private static async Task<ApplicationUser> CreateDemoUserAsync(UserManager<ApplicationUser> userManager)
        {
            var user = new ApplicationUser
            {
                UserName = DemoUserName,
                Email = "demo1@drivenest.local",
                EmailConfirmed = true,
                DisplayName = "Kovács Péter",
                Currency = "HUF"
            };

            var result = await userManager.CreateAsync(user, DemoPassword);
            if (!result.Succeeded)
            {
                throw new InvalidOperationException(
                    "A demó felhasználó létrehozása nem sikerült: " +
                    string.Join(", ", result.Errors.Select(e => e.Description)));
            }

            await userManager.AddToRoleAsync(user, "User");

            return user;
        }
    }
}
