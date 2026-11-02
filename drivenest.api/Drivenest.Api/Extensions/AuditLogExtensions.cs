using System.Globalization;
using Drivenest.Api.Data.Entities;
using Drivenest.Api.Dtos.Audit;

namespace Drivenest.Api.Extensions
{
    public static class AuditLogExtensions
    {
        // A naplózott mezők értéke szövegként, hogy a szerkesztés előtti és utáni állapot összehasonlítható legyen.
        public static Dictionary<string, string?> AuditFields(this Vehicle v, IReadOnlyDictionary<int, string> fuelTypes) => new()
        {
            ["licensePlate"] = v.LicensePlate,
            ["vin"] = v.Vin,
            ["make"] = v.Make,
            ["model"] = v.Model,
            ["year"] = v.Year?.ToString(CultureInfo.InvariantCulture),
            ["fuelType"] = fuelTypes.GetValueOrDefault(v.FuelTypeId),
            ["initialKm"] = Text(v.InitialKm),
            ["currentKm"] = Text(v.CurrentKm)
        };

        public static Dictionary<string, string?> AuditFields(this Refueling r) => new()
        {
            ["date"] = Text(r.Date),
            ["time"] = r.Time?.ToString("HH:mm", CultureInfo.InvariantCulture),
            ["odometerKm"] = Text(r.OdometerKm),
            ["liters"] = Text(r.Liters),
            ["amount"] = Text(r.TotalAmount),
            ["isFullTank"] = r.IsFullTank ? "true" : "false"
        };

        // A szerviz tételei külön mezők, így látszik, melyik tétel került be, kerül ki vagy változott.
        public static Dictionary<string, string?> AuditFields(this ServiceRecord s, IReadOnlyDictionary<int, string> categories)
        {
            var fields = new Dictionary<string, string?>
            {
                ["date"] = Text(s.Date),
                ["odometerKm"] = Text(s.OdometerKm),
                ["provider"] = s.Provider,
                ["description"] = s.Description
            };
            foreach (var item in s.Items)
                fields[$"item:{categories.GetValueOrDefault(item.CategoryId)}"] = Text(item.Amount);
            return fields;
        }

        public static Dictionary<string, string?> AuditFields(this Expense e, IReadOnlyDictionary<int, string> categories) => new()
        {
            ["date"] = Text(e.Date),
            ["category"] = categories.GetValueOrDefault(e.CategoryId),
            ["odometerKm"] = Text(e.OdometerKm),
            ["amount"] = Text(e.Amount),
            ["location"] = e.Location,
            ["description"] = e.Description
        };

        // Törlésnél az "after" üres, így a törölt adatok mind bekerülnek a naplóba.
        public static List<AuditLogChange> AuditChanges(this Dictionary<string, string?> before, Dictionary<string, string?> after)
        {
            return before.Keys.Union(after.Keys)
                .Where(field => before.GetValueOrDefault(field) != after.GetValueOrDefault(field))
                .Select(field => new AuditLogChange
                {
                    Field = field,
                    OldValue = before.GetValueOrDefault(field),
                    NewValue = after.GetValueOrDefault(field)
                })
                .ToList();
        }

        public static AuditLog ToAuditLog(this Vehicle v, string action, int userId, DateTime at, List<AuditLogChange> changes)
        {
            return NewLog(action, AuditEntryTypes.Vehicle, v.Id, v, userId, at, changes);
        }

        public static AuditLog ToAuditLog(this Refueling r, string action, int userId, DateTime at, List<AuditLogChange> changes)
        {
            var log = NewLog(action, AuditEntryTypes.Refueling, r.Id, r.Vehicle, userId, at, changes);
            log.Date = r.Date;
            log.Amount = r.TotalAmount;
            log.Liters = r.Liters;
            return log;
        }

        public static AuditLog ToAuditLog(this ServiceRecord s, IReadOnlyDictionary<int, string> categories,
            string action, int userId, DateTime at, List<AuditLogChange> changes)
        {
            var log = NewLog(action, AuditEntryTypes.Service, s.Id, s.Vehicle, userId, at, changes);
            log.Date = s.Date;
            log.Summary = string.Join(", ", s.Items.Select(i => categories.GetValueOrDefault(i.CategoryId)));
            log.Amount = s.Items.Sum(i => i.Amount);
            return log;
        }

        public static AuditLog ToAuditLog(this Expense e, IReadOnlyDictionary<int, string> categories,
            string action, int userId, DateTime at, List<AuditLogChange> changes)
        {
            var log = NewLog(action, AuditEntryTypes.Expense, e.Id, e.Vehicle, userId, at, changes);
            log.Date = e.Date;
            log.Summary = categories.GetValueOrDefault(e.CategoryId);
            log.Amount = e.Amount;
            return log;
        }

        private static AuditLog NewLog(string action, string type, int id, Vehicle vehicle, int userId, DateTime at, List<AuditLogChange> changes)
        {
            return new AuditLog
            {
                UserId = userId,
                Action = action,
                EntityType = type,
                EntityId = id,
                VehicleId = vehicle.Id,
                LicensePlate = vehicle.LicensePlate,
                VehicleName = $"{vehicle.Make} {vehicle.Model}",
                CreatedAt = at,
                Changes = changes
            };
        }

        private static string Text(int value) => value.ToString(CultureInfo.InvariantCulture);

        // A 21750.00 és a 21750 ugyanaz az érték, ezért egységes alakban tároljuk.
        private static string Text(decimal value) => value.ToString("0.###", CultureInfo.InvariantCulture);

        private static string Text(DateOnly value) => value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    }
}
