namespace Drivenest.Api.Dtos.Vehicles;

/// <summary>Vehicle returned by the API. Custom values are used when VehicleModelID is null.</summary>
public record VehicleDto(int Id, int FuelTypeId, string LicensePlate, string? Vin,
    int? VehicleModelID, string? CustomMake, string? CustomModel,
    short? Year, int InitialKm, int CurrentKm);
