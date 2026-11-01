namespace Drivenest.Api.Dtos.Audit;

public static class AuditEntryTypes
{
    public const string Vehicle = "vehicle";
    public const string Refueling = "refueling";
    public const string Service = "service";
    public const string Expense = "expense";

    public static readonly string[] All = [Vehicle, Refueling, Service, Expense];
}

// A Date, Summary, Amount és Liters csak ott van kitöltve, ahol a típusnak van ilyen adata.
// UpdatedAt = null, ha a bejegyzést létrehozása óta nem módosították.
public record AuditEntryDto(string Type, int Id, int VehicleId, string LicensePlate, string VehicleName,
    DateOnly? Date, string? Summary, decimal? Amount, decimal? Liters, DateTime CreatedAt, DateTime? UpdatedAt);
