namespace Drivenest.Api.Dtos.Vehicles;

public record VehicleDto(int Id, int FuelTypeId, string LicensePlate, string? Vin,
    string Make, string Model, short? Year, int InitialKm, int CurrentKm);
