namespace Drivenest.Api.Dtos.Stats;

// Month: "yyyy-MM"
public record MonthlyStatsDto(string Month, int DistanceKm, decimal RefuelingCost, decimal ServiceCost, decimal ExpenseCost);
