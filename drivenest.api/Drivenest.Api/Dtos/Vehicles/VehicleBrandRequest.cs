using System.ComponentModel.DataAnnotations;

namespace Drivenest.Api.Dtos.Vehicles;

/// <summary>Payload for creating or updating a vehicle brand.</summary>
public sealed record VehicleBrandRequest
{
    [Required, StringLength(50)]
    public string BrandName { get; init; } = string.Empty;
}
