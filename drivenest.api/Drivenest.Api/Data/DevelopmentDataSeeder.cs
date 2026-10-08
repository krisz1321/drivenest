using Drivenest.Api.Data.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

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
            var db = services.GetRequiredService<AppDbContext>();

            var user = await userManager.FindByNameAsync(DemoUserName)
                ?? await CreateDemoUserAsync(userManager);

            // Ha a felhasználónak már vannak járművei, a demó adatok megvannak.
            if (await db.Vehicles.AnyAsync(v => v.UserId == user.Id))
            {
                return;
            }

            var (swift, octavia) = await SeedVehiclesAsync(db, user);
            await SeedRefuelingsAsync(db, swift, octavia);
            await SeedServiceRecordsAsync(db, swift, octavia);
            await SeedExpensesAsync(db, swift, octavia);
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

        private static async Task<(Vehicle Swift, Vehicle Octavia)> SeedVehiclesAsync(AppDbContext db, ApplicationUser user)
        {
            var petrolId = await db.FuelTypes.Where(f => f.Name == "Benzin").Select(f => f.Id).SingleAsync();
            var dieselId = await db.FuelTypes.Where(f => f.Name == "Dízel").Select(f => f.Id).SingleAsync();

            var swift = new Vehicle
            {
                UserId = user.Id,
                FuelTypeId = petrolId,
                LicensePlate = "ABC-123",
                Make = "Suzuki",
                Model = "Swift",
                Year = 2018,
                InitialKm = 42000,
                CurrentKm = 47770
            };

            var octavia = new Vehicle
            {
                UserId = user.Id,
                FuelTypeId = dieselId,
                LicensePlate = "DEF-456",
                Make = "Škoda",
                Model = "Octavia",
                Year = 2015,
                InitialKm = 118000,
                CurrentKm = 124230
            };

            db.Vehicles.AddRange(swift, octavia);
            await db.SaveChangesAsync();

            return (swift, octavia);
        }

        private static async Task SeedRefuelingsAsync(AppDbContext db, Vehicle swift, Vehicle octavia)
        {
            db.Refuelings.AddRange(
                Refueling(swift, 4, 4, 42350, 31.8m, 18900),
                Refueling(swift, 4, 25, 42940, 34.1m, 20300),
                Refueling(swift, 5, 16, 43540, 35.0m, 20900),
                Refueling(swift, 6, 6, 44120, 33.6m, 20100),
                Refueling(swift, 6, 27, 44760, 36.2m, 21700),
                Refueling(swift, 7, 18, 45300, 28.0m, 16800, isFullTank: false),
                Refueling(swift, 8, 8, 46010, 36.5m, 21900),
                Refueling(swift, 8, 29, 46590, 33.9m, 20300),
                Refueling(swift, 9, 19, 47180, 34.4m, 20700),
                Refueling(swift, 10, 3, 47770, 34.9m, 21000));

            db.Refuelings.AddRange(
                Refueling(octavia, 4, 10, 118420, 42.0m, 26500),
                Refueling(octavia, 5, 2, 119150, 44.5m, 28100),
                Refueling(octavia, 5, 24, 119880, 43.2m, 27300),
                Refueling(octavia, 6, 15, 120560, 41.8m, 26400),
                Refueling(octavia, 7, 7, 121250, 40.0m, 25300, isFullTank: false),
                Refueling(octavia, 7, 29, 122050, 46.0m, 29000),
                Refueling(octavia, 8, 20, 122780, 44.1m, 27900),
                Refueling(octavia, 9, 11, 123520, 43.6m, 27500),
                Refueling(octavia, 10, 2, 124230, 42.3m, 26800));

            await db.SaveChangesAsync();
        }

        private static async Task SeedServiceRecordsAsync(AppDbContext db, Vehicle swift, Vehicle octavia)
        {
            var oilChangeId = await GetServiceCategoryIdAsync(db, "Olajcsere");
            var inspectionId = await GetServiceCategoryIdAsync(db, "Műszaki vizsga");
            var brakesId = await GetServiceCategoryIdAsync(db, "Fékrendszer");

            db.ServiceRecords.AddRange(
                ServiceRecord(swift, oilChangeId, 5, 25, 43700, "Autó-Szerviz Kft.",
                    "Olaj- és olajszűrő csere", partsCost: 14500, laborCost: 8000),
                // Három nappal később rögzítette, hogy az Audit módban látszódjon a különbség.
                ServiceRecord(swift, inspectionId, 8, 20, 46450, "Műszaki Vizsgaállomás",
                    "Műszaki vizsga, sikeres", partsCost: 0, laborCost: 22000, recordedDaysLater: 3),
                ServiceRecord(octavia, oilChangeId, 6, 2, 120100, "Autó-Szerviz Kft.",
                    "Olaj-, olajszűrő és levegőszűrő csere", partsCost: 21000, laborCost: 9500),
                ServiceRecord(octavia, brakesId, 9, 5, 123200, "Fék Centrum",
                    "Első fékbetét és tárcsa csere", partsCost: 38000, laborCost: 24000));

            await db.SaveChangesAsync();
        }

        private static async Task SeedExpensesAsync(AppDbContext db, Vehicle swift, Vehicle octavia)
        {
            var insuranceId = await GetExpenseCategoryIdAsync(db, "Biztosítás");
            var vignetteId = await GetExpenseCategoryIdAsync(db, "Autópálya-matrica");
            var washId = await GetExpenseCategoryIdAsync(db, "Mosás");

            db.Expenses.AddRange(
                Expense(swift, insuranceId, 4, 1, 62000, "Éves kötelező biztosítás"),
                Expense(swift, vignetteId, 1, 5, 24000, "Éves országos matrica"),
                Expense(swift, washId, 7, 12, 3500, null),
                Expense(octavia, insuranceId, 3, 20, 78000, "Éves kötelező biztosítás"),
                Expense(octavia, vignetteId, 1, 5, 24000, "Éves országos matrica"));

            await db.SaveChangesAsync();
        }

        private static Task<int> GetServiceCategoryIdAsync(AppDbContext db, string name)
        {
            return db.ServiceCategories.Where(c => c.Name == name).Select(c => c.Id).SingleAsync();
        }

        private static Task<int> GetExpenseCategoryIdAsync(AppDbContext db, string name)
        {
            return db.ExpenseCategories.Where(c => c.Name == name).Select(c => c.Id).SingleAsync();
        }

        private static ServiceRecord ServiceRecord(Vehicle vehicle, int categoryId, int month, int day,
            int odometerKm, string provider, string description, decimal partsCost, decimal laborCost,
            int recordedDaysLater = 0)
        {
            var date = new DateOnly(2026, month, day);

            return new ServiceRecord
            {
                Vehicle = vehicle,
                CategoryId = categoryId,
                Date = date,
                OdometerKm = odometerKm,
                Provider = provider,
                Description = description,
                PartsCost = partsCost,
                LaborCost = laborCost,
                CreatedAt = date.AddDays(recordedDaysLater).ToDateTime(new TimeOnly(18, 0), DateTimeKind.Utc)
            };
        }

        private static Expense Expense(Vehicle vehicle, int categoryId, int month, int day,
            decimal amount, string? description)
        {
            var date = new DateOnly(2026, month, day);

            return new Expense
            {
                Vehicle = vehicle,
                CategoryId = categoryId,
                Date = date,
                Amount = amount,
                Description = description,
                CreatedAt = date.ToDateTime(new TimeOnly(18, 0), DateTimeKind.Utc)
            };
        }

        // A rögzítés ideje a tankolás napján 18:00 (UTC), mintha aznap este vitte volna fel.
        private static Refueling Refueling(Vehicle vehicle, int month, int day, int odometerKm,
            decimal liters, decimal totalAmount, bool isFullTank = true)
        {
            var date = new DateOnly(2026, month, day);

            return new Refueling
            {
                Vehicle = vehicle,
                Date = date,
                OdometerKm = odometerKm,
                Liters = liters,
                TotalAmount = totalAmount,
                IsFullTank = isFullTank,
                CreatedAt = date.ToDateTime(new TimeOnly(18, 0), DateTimeKind.Utc)
            };
        }
    }
}
