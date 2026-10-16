using Drivenest.Api.Data.Entities;

namespace Drivenest.Api.Dtos.Auth
{
    public record UserDto(
        int Id,
        string Email,
        string DisplayName,
        string Currency,
        string DistanceUnit,
        string VolumeUnit,
        string ConsumptionUnit)
    {
        public static UserDto From(ApplicationUser user)
        {
            return new UserDto(
                user.Id,
                user.Email ?? string.Empty,
                user.DisplayName,
                user.Currency,
                user.DistanceUnit,
                user.VolumeUnit,
                user.ConsumptionUnit);
        }
    }
}
