using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Drivenest.Api.Data.Configurations
{
    public class IdentityRoleConfiguration : IEntityTypeConfiguration<IdentityRole<int>>
    {
        public void Configure(EntityTypeBuilder<IdentityRole<int>> builder)
        {
            builder.HasData(
                new IdentityRole<int>
                {
                    Id = 1,
                    Name = "User",
                    NormalizedName = "USER",
                    ConcurrencyStamp = "5b1c1f0e-6a52-4a0e-9d3a-0b6d2f6c1a01"
                },
                new IdentityRole<int>
                {
                    Id = 2,
                    Name = "Admin",
                    NormalizedName = "ADMIN",
                    ConcurrencyStamp = "5b1c1f0e-6a52-4a0e-9d3a-0b6d2f6c1a02"
                });
        }
    }
}
