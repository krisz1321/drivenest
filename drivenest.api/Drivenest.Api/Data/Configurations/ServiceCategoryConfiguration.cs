using Drivenest.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Drivenest.Api.Data.Configurations
{
    public class ServiceCategoryConfiguration : IEntityTypeConfiguration<ServiceCategory>
    {
        public void Configure(EntityTypeBuilder<ServiceCategory> builder)
        {
            builder.ToTable("ServiceCategories");

            builder.Property(x => x.Name)
                .HasMaxLength(100)
                .IsRequired();

            // Ugyanúgy, mint a kiadás-kategóriáknál: a név felhasználónként egyedi,
            // a beépítettek (UserId = NULL) között is. Az EF alap szűrőjét kikapcsoljuk.
            builder.HasIndex(x => new { x.UserId, x.Name })
                .IsUnique()
                .HasFilter(null);

            builder.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasData(
                new ServiceCategory { Id = 1, Name = "Olajcsere" },
                new ServiceCategory { Id = 2, Name = "Műszaki vizsga" },
                new ServiceCategory { Id = 3, Name = "Fékrendszer" },
                new ServiceCategory { Id = 4, Name = "Gumiabroncs" },
                new ServiceCategory { Id = 5, Name = "Vezérlés" },
                new ServiceCategory { Id = 6, Name = "Levegőszűrő" },
                new ServiceCategory { Id = 7, Name = "Akkumulátor" },
                new ServiceCategory { Id = 8, Name = "Általános szerviz" },
                new ServiceCategory { Id = 9, Name = "Egyéb javítás" });
        }
    }
}
