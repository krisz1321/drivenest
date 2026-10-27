using Drivenest.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Drivenest.Api.Extensions
{
    public static class VehicleKmExtensions
    {
        // A tankolások, szervizek és kiadások közül a legnagyobb óraállás (0, ha nincs bejegyzés).
        public static async Task<int> MaxOdometerKm(this AppDbContext db, int vehicleId, CancellationToken cancellationToken)
        {
            var refuelingKm = await db.Refuelings.Where(r => r.VehicleId == vehicleId).MaxAsync(r => (int?)r.OdometerKm, cancellationToken) ?? 0;
            var serviceKm = await db.ServiceRecords.Where(s => s.VehicleId == vehicleId).MaxAsync(s => (int?)s.OdometerKm, cancellationToken) ?? 0;
            var expenseKm = await db.Expenses.Where(e => e.VehicleId == vehicleId).MaxAsync(e => (int?)e.OdometerKm, cancellationToken) ?? 0;
            return Math.Max(refuelingKm, Math.Max(serviceKm, expenseKm));
        }

        // A jármű aktuális óraállását a tankolások, szervizek és kiadások óraállásából frissíti.
        // oldKm: a módosított vagy törölt bejegyzés korábbi óraállása (új bejegyzésnél null).
        public static async Task UpdateCurrentKm(this AppDbContext db, int vehicleId, int? oldKm, CancellationToken cancellationToken)
        {
            var vehicle = await db.Vehicles.SingleOrDefaultAsync(v => v.Id == vehicleId, cancellationToken);
            if (vehicle is null) return;

            var maxKm = await db.MaxOdometerKm(vehicleId, cancellationToken);

            // Ha a módosított/törölt bejegyzés adta az óraállást, a maradék bejegyzésekből számoljuk újra.
            // Különben csak nőhet, így a kézzel megadott nagyobb érték megmarad.
            if (oldKm == vehicle.CurrentKm)
                vehicle.CurrentKm = Math.Max(vehicle.InitialKm, maxKm);
            else
                vehicle.CurrentKm = Math.Max(vehicle.CurrentKm, maxKm);

            await db.SaveChangesAsync(cancellationToken);
        }
    }
}
