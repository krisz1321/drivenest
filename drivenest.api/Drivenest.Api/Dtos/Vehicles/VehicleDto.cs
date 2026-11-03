namespace Drivenest.Api.Dtos.Vehicles;

public record VehicleDto(int Id, int FuelTypeId, string LicensePlate, string? Vin,
    int? VehicleModelID, string? CustomMake, string? CustomModel,
    short? Year, int InitialKm, int CurrentKm);
