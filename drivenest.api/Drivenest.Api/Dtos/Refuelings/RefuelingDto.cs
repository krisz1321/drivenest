namespace Drivenest.Api.Dtos.Refuelings;

public record RefuelingDto(int Id, int VehicleId, DateOnly Date, int OdometerKm,
    decimal Liters, decimal TotalAmount, bool IsFullTank, DateTime CreatedAt);
