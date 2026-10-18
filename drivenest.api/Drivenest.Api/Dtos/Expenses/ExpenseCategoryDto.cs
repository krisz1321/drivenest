namespace Drivenest.Api.Dtos.Expenses;

// IsCustom = a felhasználó saját kategóriája (később lesz felvehető).
public record ExpenseCategoryDto(int Id, string Name, bool IsCustom);
