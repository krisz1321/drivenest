using Drivenest.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Drivenest.Api.Data.Configurations
{
    public class ReminderConfiguration : IEntityTypeConfiguration<Reminder>
    {
        public void Configure(EntityTypeBuilder<Reminder> builder)
        {
            builder.ToTable("Reminders", t =>
            {
                t.HasCheckConstraint("CK_Reminders_Due", "[DueDate] IS NOT NULL OR [DueOdometerKm] IS NOT NULL");
                t.HasCheckConstraint("CK_Reminders_IntervalMonths", "[IntervalMonths] IS NULL OR [IntervalMonths] > 0");
                t.HasCheckConstraint("CK_Reminders_IntervalKm", "[IntervalKm] IS NULL OR [IntervalKm] > 0");
            });

            builder.Property(r => r.Title)
                .HasMaxLength(150)
                .IsRequired();

            builder.Property(r => r.DueDate)
                .HasColumnType("date");

            builder.HasOne(r => r.Vehicle)
                .WithMany()
                .HasForeignKey(r => r.VehicleId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
