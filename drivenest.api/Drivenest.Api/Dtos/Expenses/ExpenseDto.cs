namespace Drivenest.Api.Dtos.Expenses;

public record ExpenseDto(int Id, int VehicleId, int CategoryId, string CategoryName, DateOnly Date,
    int OdometerKm, decimal Amount, string? Location, string? Description, DateTime CreatedAt);
