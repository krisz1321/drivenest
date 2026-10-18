namespace Drivenest.Api.Dtos.ServiceRecords;

public record ServiceRecordDto(int Id, int VehicleId, int CategoryId, string CategoryName, DateOnly Date,
    int OdometerKm, decimal Amount, string? Provider, string? Description, DateTime CreatedAt);
