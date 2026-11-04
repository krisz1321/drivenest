namespace Drivenest.Api.Dtos.Stats;

public record StatsSummaryDto(DateOnly? From, DateOnly To, int Days,
    decimal TotalCost, decimal RefuelingCost, decimal ServiceCost, decimal ExpenseCost,
    int DistanceKm, decimal? CostPerDay, decimal? CostPerKm, decimal? KmPerDay,
    int RefuelingCount, decimal TotalLiters, decimal? AveragePricePerLiter, decimal? AverageLiters, decimal? AverageRefuelingCost,
    decimal? AverageLitersPer100Km, decimal? BestLitersPer100Km, decimal? WorstLitersPer100Km, decimal? LastLitersPer100Km);
