using Drivenest.Api.Data.Entities;
using Drivenest.Api.Dtos.Stats;

namespace Drivenest.Api.Services;

public static class StatsMonthlyCalculator
{
    public static List<MonthlyStatsDto> Calculate(Vehicle vehicle, List<Refueling> refuelings, List<ServiceRecord> services,
        List<Expense> expenses, DateOnly? from, DateOnly to)
    {
        // Minden óraállás egy listában, a táv számolásához
        var odometers = refuelings.Select(r => (r.Date, r.OdometerKm))
            .Concat(services.Select(s => (s.Date, s.OdometerKm)))
            .Concat(expenses.Select(e => (e.Date, e.OdometerKm)))
            .ToList();

        // "from" nélkül az első bejegyzés hónapjától indulunk
        var first = from ?? odometers.Where(o => o.Date <= to).Select(o => (DateOnly?)o.Date).Min();
        var result = new List<MonthlyStatsDto>();
        if (first is null) return result;

        var month = new DateOnly(first.Value.Year, first.Value.Month, 1);
        while (month <= to)
        {
            // A hónap első és utolsó napja, de az időszakon belül
            var start = month < first.Value ? first.Value : month;
            var endOfMonth = month.AddMonths(1).AddDays(-1);
            var end = endOfMonth > to ? to : endOfMonth;
            bool InMonth(DateOnly date) => date >= start && date <= end;

            // Ugyanúgy, mint az összesítőnél: a hónap legnagyobb óraállása mínusz az előtte lévő utolsó
            var inMonth = odometers.Where(o => InMonth(o.Date)).Select(o => o.OdometerKm).ToList();
            var before = odometers.Where(o => o.Date < start).Select(o => o.OdometerKm).DefaultIfEmpty(vehicle.InitialKm).Max();
            var distance = inMonth.Count == 0 ? 0 : Math.Max(0, inMonth.Max() - before);

            result.Add(new MonthlyStatsDto(month.ToString("yyyy-MM"), distance,
                refuelings.Where(r => InMonth(r.Date)).Sum(r => r.TotalAmount),
                services.Where(s => InMonth(s.Date)).Sum(s => s.Items.Sum(i => i.Amount)),
                expenses.Where(e => InMonth(e.Date)).Sum(e => e.Amount)));

            month = month.AddMonths(1);
        }

        return result;
    }
}
