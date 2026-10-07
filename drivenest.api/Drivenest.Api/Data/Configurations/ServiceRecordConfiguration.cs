using Drivenest.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Drivenest.Api.Data.Configurations
{
    public class ServiceRecordConfiguration : IEntityTypeConfiguration<ServiceRecord>
    {
        public void Configure(EntityTypeBuilder<ServiceRecord> builder)
        {
            builder.ToTable("ServiceRecords", t =>
            {
                t.HasCheckConstraint("CK_ServiceRecords_OdometerKm", "[OdometerKm] >= 0");
                t.HasCheckConstraint("CK_ServiceRecords_PartsCost", "[PartsCost] >= 0");
                t.HasCheckConstraint("CK_ServiceRecords_LaborCost", "[LaborCost] >= 0");
            });

            builder.Property(s => s.Date)
                .HasColumnType("date");

            builder.Property(s => s.Provider)
                .HasMaxLength(150);

            builder.Property(s => s.Description)
                .HasMaxLength(2000);

            builder.Property(s => s.PartsCost)
                .HasColumnType("decimal(12,2)")
                .HasDefaultValue(0m);

            builder.Property(s => s.LaborCost)
                .HasColumnType("decimal(12,2)")
                .HasDefaultValue(0m);

            builder.HasIndex(s => new { s.VehicleId, s.Date, s.OdometerKm })
                .IsDescending(false, true, true);

            builder.Property(s => s.CreatedAt)
                .HasColumnType("datetime2(3)")
                .HasDefaultValueSql("SYSUTCDATETIME()")
                .ValueGeneratedOnAdd()
                .Metadata.SetAfterSaveBehavior(PropertySaveBehavior.Ignore);

            builder.HasOne(s => s.Vehicle)
                .WithMany()
                .HasForeignKey(s => s.VehicleId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(s => s.Category)
                .WithMany()
                .HasForeignKey(s => s.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
