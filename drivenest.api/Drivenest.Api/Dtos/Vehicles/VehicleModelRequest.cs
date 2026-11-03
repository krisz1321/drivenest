using System.ComponentModel.DataAnnotations;

namespace Drivenest.Api.Dtos.Vehicles;

/// <summary>Payload for creating or updating a vehicle model.</summary>
public sealed record VehicleModelRequest
{
    [Required, StringLength(50)]
    public string ModelName { get; init; } = string.Empty;

    [Range(1, int.MaxValue)]
    public int VehicleBrandId { get; init; }
}
