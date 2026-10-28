namespace Drivenest.Api.Dtos.Stats;

public record ConsumptionSegmentDto(int StartRefuelingId, int EndRefuelingId, DateOnly StartDate, DateOnly EndDate,
    int DistanceKm, decimal Liters, decimal LitersPer100Km);

public record ConsumptionDto(decimal? LastLitersPer100Km, decimal? AverageLitersPer100Km,
    List<ConsumptionSegmentDto> Segments);
