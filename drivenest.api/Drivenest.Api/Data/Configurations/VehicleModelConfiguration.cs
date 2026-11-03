using Drivenest.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Drivenest.Api.Data.Configurations;

public class VehicleModelConfiguration : IEntityTypeConfiguration<VehicleModel>
{
    public void Configure(EntityTypeBuilder<VehicleModel> builder)
    {
        builder.ToTable("VehicleModels");

        builder.Property(m => m.ModelName)
            .HasMaxLength(50)
            .IsRequired();

        builder.HasIndex(m => new { m.VehicleBrandId, m.ModelName })
            .IsUnique();

        builder.HasOne(m => m.VehicleBrand)
            .WithMany(b => b.Models)
            .HasForeignKey(m => m.VehicleBrandId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
