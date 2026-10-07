using Drivenest.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Drivenest.Api.Data.Configurations
{
    public class VehicleConfiguration : IEntityTypeConfiguration<Vehicle>
    {
        public void Configure(EntityTypeBuilder<Vehicle> builder)
        {
            builder.ToTable("Vehicles", t =>
            {
                t.HasCheckConstraint("CK_Vehicles_Vin", "[Vin] IS NULL OR LEN([Vin]) = 17");
                t.HasCheckConstraint("CK_Vehicles_Year", "[Year] IS NULL OR [Year] BETWEEN 1886 AND 2100");
                t.HasCheckConstraint("CK_Vehicles_InitialKm", "[InitialKm] >= 0");
                t.HasCheckConstraint("CK_Vehicles_CurrentKm", "[CurrentKm] >= [InitialKm]");
            });

            builder.Property(v => v.LicensePlate)
                .HasMaxLength(20)
                .IsRequired();

            builder.Property(v => v.Vin)
                .HasColumnType("varchar(17)");

            builder.Property(v => v.Make)
                .HasMaxLength(50)
                .IsRequired();

            builder.Property(v => v.Model)
                .HasMaxLength(50)
                .IsRequired();

            builder.HasIndex(v => new { v.UserId, v.LicensePlate })
                .IsUnique();

            builder.HasOne(v => v.User)
                .WithMany()
                .HasForeignKey(v => v.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(v => v.FuelType)
                .WithMany()
                .HasForeignKey(v => v.FuelTypeId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
