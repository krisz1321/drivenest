namespace Drivenest.Api.Dtos.ServiceRecords;

public record ServiceRecordDto(int Id, int VehicleId, int CategoryId, string CategoryName,
    DateOnly Date, int OdometerKm, string? Provider, string? Description,
    decimal PartsCost, decimal LaborCost, DateTime CreatedAt);
