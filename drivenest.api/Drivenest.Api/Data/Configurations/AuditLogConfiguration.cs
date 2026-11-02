using Drivenest.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Drivenest.Api.Data.Configurations
{
    public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
    {
        public void Configure(EntityTypeBuilder<AuditLog> builder)
        {
            builder.ToTable("AuditLogs");

            builder.Property(a => a.Action)
                .HasMaxLength(20)
                .IsRequired();

            builder.Property(a => a.EntityType)
                .HasMaxLength(20)
                .IsRequired();

            builder.Property(a => a.LicensePlate)
                .HasMaxLength(20)
                .IsRequired();

            builder.Property(a => a.VehicleName)
                .HasMaxLength(101)
                .IsRequired();

            builder.Property(a => a.Date)
                .HasColumnType("date");

            builder.Property(a => a.EntityCreatedAt)
                .HasColumnType("datetime2(3)");

            builder.Property(a => a.Amount)
                .HasColumnType("decimal(14,2)");

            builder.Property(a => a.Liters)
                .HasColumnType("decimal(9,3)");

            builder.Property(a => a.CreatedAt)
                .HasColumnType("datetime2(3)")
                .HasDefaultValueSql("SYSUTCDATETIME()")
                .ValueGeneratedOnAdd()
                .Metadata.SetAfterSaveBehavior(PropertySaveBehavior.Ignore);

            builder.HasIndex(a => new { a.UserId, a.CreatedAt })
                .IsDescending(false, true);

            builder.HasOne(a => a.User)
                .WithMany()
                .HasForeignKey(a => a.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasMany(a => a.Changes)
                .WithOne()
                .HasForeignKey(c => c.AuditLogId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
