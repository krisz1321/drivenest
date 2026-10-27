namespace Drivenest.Api.Dtos.ServiceRecords;

// IsCustom = a felhasználó saját szerviztípusa (később lesz felvehető).
public record ServiceCategoryDto(int Id, string Name, bool IsCustom);
