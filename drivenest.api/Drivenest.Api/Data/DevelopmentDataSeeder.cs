using Drivenest.Api.Data.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Drivenest.Api.Data
{
    // Csak fejlesztői környezetben fut: demó felhasználók és adatok, hogy ne üres adatbázison dolgozzunk.
    public static class DevelopmentDataSeeder
    {
        private const string DemoUserName = "demo1";
        private const string SecondDemoUserName = "demo2";
        private const string DemoPassword = "Demo123!";
        private const string AdminUserName = "admin";
        private const string AdminPassword = "admin";

        public static async Task SeedAsync(IServiceProvider services)
        {
            var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
            var db = services.GetRequiredService<AppDbContext>();

            if (await userManager.FindByNameAsync(AdminUserName) == null)
            {
                await CreateAdminUserAsync(userManager);
            }

            await SeedFirstDemoUserAsync(userManager, db);
            await SeedSecondDemoUserAsync(userManager, db);
        }

        private static async Task SeedFirstDemoUserAsync(UserManager<ApplicationUser> userManager, AppDbContext db)
        {
            var user = await userManager.FindByNameAsync(DemoUserName)
                ?? await CreateDemoUserAsync(userManager, DemoUserName, "demo1@drivenest.local", "Szék Elek");

            // Ha a felhasználónak már vannak járművei, a demó adatok megvannak.
            if (await db.Vehicles.AnyAsync(v => v.UserId == user.Id))
            {
                return;
            }

            var (swift, octavia) = await SeedVehiclesAsync(db, user);
            await SeedRefuelingsAsync(db, swift, octavia);
            await SeedServiceRecordsAsync(db, swift, octavia);
            await SeedExpensesAsync(db, swift, octavia);
            await SeedRemindersAsync(db, swift, octavia);
        }

        private static async Task SeedSecondDemoUserAsync(UserManager<ApplicationUser> userManager, AppDbContext db)
        {
            var user = await userManager.FindByNameAsync(SecondDemoUserName)
                ?? await CreateDemoUserAsync(userManager, SecondDemoUserName, "demo2@drivenest.local", "Pofá Zoltán");

            if (await db.Vehicles.AnyAsync(v => v.UserId == user.Id))
            {
                return;
            }

            await SeedAstraAsync(db, user);
        }

        // Fix, gyenge jelszót kap, ezért nem a jelszószabályon keresztül hozzuk létre:
        // a hash-t közvetlenül állítjuk be. Bejelentkezéskor a szabályt nem ellenőrzi az Identity.
        private static async Task CreateAdminUserAsync(UserManager<ApplicationUser> userManager)
        {
            var admin = new ApplicationUser
            {
                UserName = AdminUserName,
                Email = "admin@drivenest.local",
                EmailConfirmed = true,
                DisplayName = "Bevíz Elek",
                Currency = "HUF"
            };
            admin.PasswordHash = userManager.PasswordHasher.HashPassword(admin, AdminPassword);

            var result = await userManager.CreateAsync(admin);
            if (!result.Succeeded)
            {
                throw new InvalidOperationException(
                    "Az admin felhasználó létrehozása nem sikerült: " +
                    string.Join(", ", result.Errors.Select(e => e.Description)));
            }

            await userManager.AddToRoleAsync(admin, "Admin");
        }

        private static async Task<ApplicationUser> CreateDemoUserAsync(UserManager<ApplicationUser> userManager,
            string userName, string email, string displayName)
        {
            var user = new ApplicationUser
            {
                UserName = userName,
                Email = email,
                EmailConfirmed = true,
                DisplayName = displayName,
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
            var oilFilterId = await GetServiceCategoryIdAsync(db, "Olajszűrő");
            var airFilterId = await GetServiceCategoryIdAsync(db, "Levegőszűrő");
            var inspectionId = await GetServiceCategoryIdAsync(db, "Műszaki ellenőrzés");
            var brakePadId = await GetServiceCategoryIdAsync(db, "Fékbetét");
            var brakeDiscId = await GetServiceCategoryIdAsync(db, "Első féktárcsák");
            var laborId = await GetServiceCategoryIdAsync(db, "Szervíz költség");

            // Egy szerviz több tételből áll, a munkadíj is egy tétel ("Szervíz költség").
            db.ServiceRecords.AddRange(
                ServiceRecord(swift, 5, 25, 43700, "Autó-Szerviz Kft.", "Motorolaj 5W-30",
                    [Item(oilChangeId, 11000), Item(oilFilterId, 3500), Item(laborId, 8000)]),
                // Három nappal később rögzítette, hogy az Audit módban látszódjon a különbség.
                ServiceRecord(swift, 8, 20, 46450, "Műszaki Vizsgaállomás", "Műszaki vizsga, sikeres",
                    [Item(inspectionId, 22000)], recordedDaysLater: 3),
                ServiceRecord(octavia, 6, 2, 120100, "Autó-Szerviz Kft.", "Olaj-, olajszűrő és levegőszűrő csere",
                    [Item(oilChangeId, 13000), Item(oilFilterId, 4000), Item(airFilterId, 4000), Item(laborId, 9500)]),
                ServiceRecord(octavia, 9, 5, 123200, "Fék Centrum", "Első fékbetét és tárcsa csere",
                    [Item(brakePadId, 16000), Item(brakeDiscId, 22000), Item(laborId, 24000)]));

            await db.SaveChangesAsync();
        }

        private static async Task SeedExpensesAsync(AppDbContext db, Vehicle swift, Vehicle octavia)
        {
            var insuranceId = await GetExpenseCategoryIdAsync(db, "Biztosítás");
            var vignetteId = await GetExpenseCategoryIdAsync(db, "Autópálya matrica");
            var washId = await GetExpenseCategoryIdAsync(db, "Autómosó");
            var parkingId = await GetExpenseCategoryIdAsync(db, "Parkolás");
            var tollId = await GetExpenseCategoryIdAsync(db, "Útdíjak");

            db.Expenses.AddRange(
                Expense(swift, insuranceId, 4, 1, 42300, 62000, null, "Éves kötelező biztosítás"),
                Expense(swift, vignetteId, 1, 5, 42050, 24000, "Online (nemzetiutdij.hu)", "Éves országos matrica"),
                Expense(swift, washId, 7, 12, 45200, 3500, "Shell autómosó", null),
                Expense(swift, parkingId, 8, 20, 46100, 1800, "Budapest, Belváros", "Mozi előtt 3 óra"),
                Expense(octavia, insuranceId, 3, 20, 119000, 78000, null, "Éves kötelező biztosítás"),
                Expense(octavia, vignetteId, 1, 5, 118150, 24000, "Online (nemzetiutdij.hu)", "Éves országos matrica"),
                Expense(octavia, tollId, 7, 3, 121800, 4900, "Hegyeshalom", "Osztrák 10 napos matrica"));

            await db.SaveChangesAsync();
        }

        private static async Task SeedRemindersAsync(AppDbContext db, Vehicle swift, Vehicle octavia)
        {
            db.Reminders.AddRange(
                new Reminder
                {
                    Vehicle = swift,
                    Title = "Olajcsere",
                    DueDate = new DateOnly(2027, 5, 25),
                    DueOdometerKm = 53700,
                    IntervalMonths = 12,
                    IntervalKm = 10000
                },
                new Reminder
                {
                    Vehicle = swift,
                    Title = "Műszaki vizsga",
                    DueDate = new DateOnly(2028, 8, 20),
                    IntervalMonths = 24
                },
                new Reminder
                {
                    Vehicle = octavia,
                    Title = "Olajcsere",
                    DueDate = new DateOnly(2027, 6, 2),
                    DueOdometerKm = 130100,
                    IntervalMonths = 12,
                    IntervalKm = 10000
                },
                new Reminder
                {
                    Vehicle = octavia,
                    Title = "Biztosítás évforduló",
                    DueDate = new DateOnly(2027, 3, 20),
                    IntervalMonths = 12
                });

            await db.SaveChangesAsync();
        }

        // A második demó felhasználó egyetlen, nagy futású öreg dízele.
        private static async Task SeedAstraAsync(AppDbContext db, ApplicationUser user)
        {
            var dieselId = await db.FuelTypes.Where(f => f.Name == "Dízel").Select(f => f.Id).SingleAsync();
            var oilChangeId = await GetServiceCategoryIdAsync(db, "Olajcsere");
            var oilFilterId = await GetServiceCategoryIdAsync(db, "Olajszűrő");
            var inspectionId = await GetServiceCategoryIdAsync(db, "Műszaki ellenőrzés");
            var laborId = await GetServiceCategoryIdAsync(db, "Szervíz költség");
            var insuranceId = await GetExpenseCategoryIdAsync(db, "Biztosítás");
            var carId = await GetExpenseCategoryIdAsync(db, "Autó");
            var washId = await GetExpenseCategoryIdAsync(db, "Autómosó");

            var astra = new Vehicle
            {
                UserId = user.Id,
                FuelTypeId = dieselId,
                LicensePlate = "GHI-789",
                Make = "Opel",
                Model = "Astra F 1.7 TD",
                Year = 1992,
                InitialKm = 405000,
                CurrentKm = 409200
            };

            db.Refuelings.AddRange(
                Refueling(astra, 4, 12, 405600, 38.5m, 23900),
                Refueling(astra, 5, 10, 406180, 37.8m, 23500),
                Refueling(astra, 6, 7, 406800, 40.2m, 25000),
                Refueling(astra, 7, 5, 407350, 35.5m, 22000, isFullTank: false),
                Refueling(astra, 8, 2, 408010, 42.0m, 26100),
                Refueling(astra, 8, 30, 408590, 37.4m, 23300),
                Refueling(astra, 9, 27, 409200, 39.6m, 24600));

            db.ServiceRecords.AddRange(
                ServiceRecord(astra, 6, 20, 406950, "Barkácsműhely", "Olaj- és olajszűrő csere",
                    [Item(oilChangeId, 14000), Item(oilFilterId, 4000), Item(laborId, 7000)]),
                ServiceRecord(astra, 9, 14, 409000, "Műszaki Vizsgaállomás", "Műszaki vizsga, sikeres",
                    [Item(inspectionId, 40000)]));

            db.Expenses.AddRange(
                Expense(astra, insuranceId, 2, 10, 405000, 54000, null, "Éves kötelező biztosítás"),
                Expense(astra, carId, 3, 15, 405300, 18000, null, "Gépjárműadó"),
                Expense(astra, washId, 5, 30, 406500, 2500, "Kézi autómosó", null));

            db.Reminders.AddRange(
                new Reminder
                {
                    Vehicle = astra,
                    Title = "Olajcsere",
                    DueDate = new DateOnly(2027, 6, 20),
                    DueOdometerKm = 416950,
                    IntervalMonths = 12,
                    IntervalKm = 10000
                },
                new Reminder
                {
                    Vehicle = astra,
                    Title = "Téli gumi csere",
                    DueDate = new DateOnly(2026, 11, 15),
                    IntervalMonths = 6
                },
                new Reminder
                {
                    Vehicle = astra,
                    Title = "Műszaki vizsga",
                    DueDate = new DateOnly(2028, 9, 14),
                    IntervalMonths = 24
                });

            db.Vehicles.Add(astra);
            await db.SaveChangesAsync();
        }

        private static Task<int> GetServiceCategoryIdAsync(AppDbContext db, string name)
        {
            return db.ServiceCategories.Where(c => c.UserId == null && c.Name == name).Select(c => c.Id).SingleAsync();
        }

        private static Task<int> GetExpenseCategoryIdAsync(AppDbContext db, string name)
        {
            return db.ExpenseCategories.Where(c => c.UserId == null && c.Name == name).Select(c => c.Id).SingleAsync();
        }

        private static ServiceRecord ServiceRecord(Vehicle vehicle, int month, int day, int odometerKm,
            string provider, string? description, List<ServiceRecordItem> items, int recordedDaysLater = 0)
        {
            var date = new DateOnly(2026, month, day);

            return new ServiceRecord
            {
                Vehicle = vehicle,
                Date = date,
                OdometerKm = odometerKm,
                Provider = provider,
                Description = description,
                Items = items,
                CreatedAt = date.AddDays(recordedDaysLater).ToDateTime(new TimeOnly(18, 0), DateTimeKind.Utc)
            };
        }

        private static ServiceRecordItem Item(int categoryId, decimal amount)
        {
            return new ServiceRecordItem { CategoryId = categoryId, Amount = amount };
        }

        private static Expense Expense(Vehicle vehicle, int categoryId, int month, int day,
            int odometerKm, decimal amount, string? location, string? description)
        {
            var date = new DateOnly(2026, month, day);

            return new Expense
            {
                Vehicle = vehicle,
                CategoryId = categoryId,
                Date = date,
                OdometerKm = odometerKm,
                Amount = amount,
                Location = location,
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
