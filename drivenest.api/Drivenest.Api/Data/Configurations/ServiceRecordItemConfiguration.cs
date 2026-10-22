using Drivenest.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Drivenest.Api.Data.Configurations
{
    public class ServiceRecordItemConfiguration : IEntityTypeConfiguration<ServiceRecordItem>
    {
        public void Configure(EntityTypeBuilder<ServiceRecordItem> builder)
        {
            builder.ToTable("ServiceRecordItems", t =>
            {
                t.HasCheckConstraint("CK_ServiceRecordItems_Amount", "[Amount] >= 0");
            });

            builder.Property(i => i.Amount)
                .HasColumnType("decimal(12,2)");

            // Egy szervizen belül egy típus csak egyszer szerepelhet.
            builder.HasIndex(i => new { i.ServiceRecordId, i.CategoryId })
                .IsUnique();

            // A szerviz törlésekor a tételei is törlődnek.
            builder.HasOne(i => i.ServiceRecord)
                .WithMany(s => s.Items)
                .HasForeignKey(i => i.ServiceRecordId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(i => i.Category)
                .WithMany()
                .HasForeignKey(i => i.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
