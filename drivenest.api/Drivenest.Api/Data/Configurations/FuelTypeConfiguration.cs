using Drivenest.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Drivenest.Api.Data.Configurations
{
    public class FuelTypeConfiguration : IEntityTypeConfiguration<FuelType>
    {
        public void Configure(EntityTypeBuilder<FuelType> builder)
        {
            builder.ToTable("FuelTypes");

            builder.Property(x => x.Name)
                .HasMaxLength(100)
                .IsRequired();

            builder.HasIndex(x => x.Name)
                .IsUnique();

            builder.HasData(
                new FuelType { Id = 1, Name = "Benzin" },
                new FuelType { Id = 2, Name = "Dízel" },
                new FuelType { Id = 3, Name = "Hibrid" },
                new FuelType { Id = 4, Name = "LPG" });
        }
    }
}
