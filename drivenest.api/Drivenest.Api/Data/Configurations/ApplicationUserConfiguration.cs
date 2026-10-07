using Drivenest.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Drivenest.Api.Data.Configurations
{
    public class ApplicationUserConfiguration : IEntityTypeConfiguration<ApplicationUser>
    {
        public void Configure(EntityTypeBuilder<ApplicationUser> builder)
        {
            builder.ToTable("Users", t => t.HasCheckConstraint("CK_Users_Currency", "[Currency] IN ('HUF', 'EUR')"));

            builder.Property(u => u.DisplayName)
                .HasMaxLength(100)
                .IsRequired();

            builder.Property(u => u.Currency)
                .HasColumnType("char(3)")
                .HasDefaultValue("HUF")
                .IsRequired();
        }
    }
}
