namespace Drivenest.Api.Dtos.Audit;

public static class AuditEntryTypes
{
    public const string Vehicle = "vehicle";
    public const string Refueling = "refueling";
    public const string Service = "service";
    public const string Expense = "expense";

    public static readonly string[] All = [Vehicle, Refueling, Service, Expense];
}

public static class AuditActions
{
    public const string Added = "added";
    public const string Updated = "updated";
    public const string Deleted = "deleted";

    public static readonly string[] All = [Added, Updated, Deleted];
}

// A Date, Summary, Amount és Liters csak ott van kitöltve, ahol a típusnak van ilyen adata.
// UpdatedAt = null, ha a bejegyzést létrehozása óta nem módosították.
// DeletedAt csak a 7 napon belül törölt bejegyzésnél van kitöltve, ezek már csak a naplóban vannak meg.
// ImportSource = "drivvo", ha a bejegyzés importból jött, ilyenkor a CreatedAt az importálás ideje.
public record AuditEntryDto(string Type, int Id, int VehicleId, string LicensePlate, string VehicleName,
    DateOnly? Date, string? Summary, decimal? Amount, decimal? Liters, DateTime CreatedAt, DateTime? UpdatedAt, DateTime? DeletedAt = null, string? ImportSource = null);

public record AuditChangeFieldDto(string Field, string? OldValue, string? NewValue);

// Action = added: utólag rögzített bejegyzés, ilyenkor a DaysLate mondja meg, hány nappal a dátuma után vitték fel.
public record AuditChangeDto(string Action, string Type, int EntityId, int VehicleId, string LicensePlate, string VehicleName,
    DateOnly? Date, string? Summary, decimal? Amount, decimal? Liters, DateTime ChangedAt, int? DaysLate, List<AuditChangeFieldDto> Changes, string? ImportSource = null);
