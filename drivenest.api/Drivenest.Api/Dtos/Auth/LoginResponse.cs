namespace Drivenest.Api.Dtos.Auth
{
    public record LoginResponse(string Token, DateTime ExpiresAtUtc, UserDto User, IReadOnlyList<string> Roles);
}
