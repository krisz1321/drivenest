using Drivenest.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Drivenest.Api.Data.Configurations
{
    public class RefuelingConfiguration : IEntityTypeConfiguration<Refueling>
    {
        public void Configure(EntityTypeBuilder<Refueling> builder)
        {
            builder.ToTable("Refuelings", t =>
            {
                t.HasCheckConstraint("CK_Refuelings_OdometerKm", "[OdometerKm] >= 0");
                t.HasCheckConstraint("CK_Refuelings_Liters", "[Liters] > 0");
                t.HasCheckConstraint("CK_Refuelings_TotalAmount", "[TotalAmount] >= 0");
            });

            builder.Property(r => r.Date)
                .HasColumnType("date");

            builder.Property(r => r.Liters)
                .HasColumnType("decimal(9,3)");

            builder.Property(r => r.TotalAmount)
                .HasColumnType("decimal(12,2)");

            builder.Property(r => r.IsFullTank)
                .HasDefaultValue(true);

            builder.HasIndex(r => new { r.VehicleId, r.Date, r.OdometerKm })
                .IsDescending(false, true, true);

            builder.Property(r => r.CreatedAt)
                .HasColumnType("datetime2(3)")
                .HasDefaultValueSql("SYSUTCDATETIME()")
                .ValueGeneratedOnAdd()
                .Metadata.SetAfterSaveBehavior(PropertySaveBehavior.Ignore);

            builder.HasOne(r => r.Vehicle)
                .WithMany()
                .HasForeignKey(r => r.VehicleId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
