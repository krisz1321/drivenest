using Drivenest.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Drivenest.Api.Data.Configurations
{
    public class AuditLogChangeConfiguration : IEntityTypeConfiguration<AuditLogChange>
    {
        public void Configure(EntityTypeBuilder<AuditLogChange> builder)
        {
            builder.ToTable("AuditLogChanges");

            builder.Property(c => c.Field)
                .HasMaxLength(200)
                .IsRequired();

            builder.Property(c => c.OldValue)
                .HasMaxLength(2000);

            builder.Property(c => c.NewValue)
                .HasMaxLength(2000);
        }
    }
}
