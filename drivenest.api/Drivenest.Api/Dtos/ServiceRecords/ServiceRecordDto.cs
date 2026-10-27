namespace Drivenest.Api.Dtos.ServiceRecords;

// Total = a tételek összege
public record ServiceRecordDto(int Id, int VehicleId, DateOnly Date, int OdometerKm, decimal Total,
    string? Provider, string? Description, DateTime CreatedAt, List<ServiceRecordItemDto> Items);

public record ServiceRecordItemDto(int CategoryId, string CategoryName, decimal Amount);
