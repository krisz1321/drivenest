using Drivenest.Api.Data.Entities;
using Drivenest.Api.Dtos.Stats;

namespace Drivenest.Api.Services;

public static class StatsSummaryCalculator
{
    public static StatsSummaryDto Calculate(Vehicle vehicle, List<Refueling> refuelings, List<ServiceRecord> services,
        List<Expense> expenses, DateOnly? from, DateOnly to)
    {
        bool InPeriod(DateOnly date) => (from is null || date >= from) && date <= to;

        var periodRefuelings = refuelings.Where(r => InPeriod(r.Date)).ToList();
        var periodServices = services.Where(s => InPeriod(s.Date)).ToList();
        var periodExpenses = expenses.Where(e => InPeriod(e.Date)).ToList();

        var refuelingCost = periodRefuelings.Sum(r => r.TotalAmount);
        var serviceCost = periodServices.Sum(s => s.Items.Sum(i => i.Amount));
        var expenseCost = periodExpenses.Sum(e => e.Amount);
        var totalCost = refuelingCost + serviceCost + expenseCost;

        // Táv: az időszak legnagyobb óraállása mínusz az időszak előtti utolsó (ha nincs, a kezdő km)
        var odometers = periodRefuelings.Select(r => r.OdometerKm)
            .Concat(periodServices.Select(s => s.OdometerKm))
            .Concat(periodExpenses.Select(e => e.OdometerKm))
            .ToList();
        var before = refuelings.Where(r => r.Date < from).Select(r => r.OdometerKm)
            .Concat(services.Where(s => s.Date < from).Select(s => s.OdometerKm))
            .Concat(expenses.Where(e => e.Date < from).Select(e => e.OdometerKm))
            .DefaultIfEmpty(vehicle.InitialKm)
            .Max();
        var distance = odometers.Count == 0 ? 0 : Math.Max(0, odometers.Max() - before);

        // Napok: a kezdettől (vagy az első bejegyzéstől) a végéig, mindkét napot beleszámolva
        var dates = periodRefuelings.Select(r => r.Date)
            .Concat(periodServices.Select(s => s.Date))
            .Concat(periodExpenses.Select(e => e.Date))
            .ToList();
        DateOnly? start = from ?? (dates.Count == 0 ? null : dates.Min());
        var days = start is null ? 0 : Math.Max(0, to.DayNumber - start.Value.DayNumber + 1);

        var liters = periodRefuelings.Sum(r => r.Liters);
        var count = periodRefuelings.Count;

        // Fogyasztásnál a teljes listából számolunk, és azok a szakaszok kellenek, amik az időszakban zárultak
        var segments = FuelConsumptionCalculator.Calculate(refuelings).Segments.Where(s => InPeriod(s.EndDate)).ToList();
        decimal? average = segments.Count == 0 ? null
            : Math.Round(segments.Sum(s => s.Liters) * 100 / segments.Sum(s => s.DistanceKm), 2);

        return new StatsSummaryDto(from, to, days,
            totalCost, refuelingCost, serviceCost, expenseCost,
            distance, Divide(totalCost, days), Divide(totalCost, distance), Divide(distance, days),
            count, liters, Divide(refuelingCost, liters), Divide(liters, count), Divide(refuelingCost, count),
            average,
            segments.Count == 0 ? null : segments.Min(s => s.LitersPer100Km),
            segments.Count == 0 ? null : segments.Max(s => s.LitersPer100Km),
            segments.Count == 0 ? null : segments[^1].LitersPer100Km);
    }

    private static decimal? Divide(decimal value, decimal by) => by == 0 ? null : Math.Round(value / by, 2);
}
