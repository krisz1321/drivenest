namespace Drivenest.Api.Dtos.Vehicles;

/// <summary>Vehicle model in the shared vehicle catalog.</summary>
public sealed record VehicleModelDto(int Id, string ModelName, int VehicleBrandId);
