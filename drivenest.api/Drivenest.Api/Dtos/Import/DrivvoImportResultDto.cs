namespace Drivenest.Api.Dtos.Import;

// Skipped = kihagyott bejegyzések száma (már megvolt, vagy hibás volt a sor).
public record DrivvoImportResultDto(int Refuelings, int Expenses, int Services, int Skipped);
