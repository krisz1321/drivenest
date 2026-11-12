namespace Drivenest.Api.Dtos.ServiceRecords;

// A szervizkönyv PDF adatai. DeletedCount = a naplóban szereplő törölt szervizek száma.
public record ServiceBookDto(ServiceBookVehicleDto Vehicle, DateTime GeneratedAt, int DeletedCount, List<ServiceBookEntryDto> Entries);

public record ServiceBookVehicleDto(string LicensePlate, string? Vin, string Make, string Model, short? Year, string FuelType, int CurrentKm);

// DaysLate = hány nappal a szerviz dátuma után rögzítették, IsLate = utólag rögzített bejegyzés.
// ImportSource = "drivvo", ha importból jött.
public record ServiceBookEntryDto(DateOnly Date, int OdometerKm, decimal Total, string? Provider, string? Description,
    DateTime CreatedAt, DateTime? UpdatedAt, int DaysLate, bool IsLate, string? ImportSource, List<ServiceRecordItemDto> Items);
