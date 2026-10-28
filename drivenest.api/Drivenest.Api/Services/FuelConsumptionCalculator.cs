using Drivenest.Api.Data.Entities;
using Drivenest.Api.Dtos.Stats;

namespace Drivenest.Api.Services;

// Fogyasztás tele tanktól tele tankig: a szakasz literei a záró tele tankolás és a köztes részleges tankolások literei.
public static class FuelConsumptionCalculator
{
    public static ConsumptionDto Calculate(IEnumerable<Refueling> refuelings)
    {
        var segments = new List<ConsumptionSegmentDto>();
        Refueling? start = null;
        decimal liters = 0;

        foreach (var r in refuelings.OrderBy(r => r.Date).ThenBy(r => r.OdometerKm).ThenBy(r => r.Id))
        {
            // Az első tele tank előtti tankolások nem számítanak.
            if (start is null)
            {
                if (r.IsFullTank) start = r;
                continue;
            }

            liters += r.Liters;
            if (!r.IsFullTank) continue;

            // Hibás óraállásnál (0 vagy negatív távolság) a szakasz kimarad, de innen újraindul.
            var distance = r.OdometerKm - start.OdometerKm;
            if (distance > 0)
                segments.Add(new ConsumptionSegmentDto(start.Id, r.Id, start.Date, r.Date, distance, liters, Per100Km(liters, distance)));

            start = r;
            liters = 0;
        }

        if (segments.Count == 0) return new ConsumptionDto(null, null, segments);

        // Az átlag az összes liter és km aránya, nem a szakaszok átlaga.
        var average = Per100Km(segments.Sum(s => s.Liters), segments.Sum(s => s.DistanceKm));
        return new ConsumptionDto(segments[^1].LitersPer100Km, average, segments);
    }

    private static decimal Per100Km(decimal liters, int distanceKm) => Math.Round(liters * 100 / distanceKm, 2);
}
