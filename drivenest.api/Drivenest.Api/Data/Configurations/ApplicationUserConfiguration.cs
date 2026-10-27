using Drivenest.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Drivenest.Api.Data.Configurations
{
    public class ApplicationUserConfiguration : IEntityTypeConfiguration<ApplicationUser>
    {
        public void Configure(EntityTypeBuilder<ApplicationUser> builder)
        {
            builder.ToTable("Users", t =>
            {
                t.HasCheckConstraint("CK_Users_Currency", "[Currency] IN ('HUF', 'EUR')");
                t.HasCheckConstraint("CK_Users_DistanceUnit", "[DistanceUnit] IN ('km', 'mi')");
                t.HasCheckConstraint("CK_Users_VolumeUnit", "[VolumeUnit] IN ('l', 'gal')");
                t.HasCheckConstraint("CK_Users_ConsumptionUnit", "[ConsumptionUnit] IN ('l/100km', 'km/l', 'mpg')");
            });

            builder.Property(u => u.DisplayName)
                .HasMaxLength(100)
                .IsRequired();

            builder.Property(u => u.Currency)
                .HasColumnType("char(3)")
                .HasDefaultValue(UserPreferences.Huf)
                .IsRequired();

            builder.Property(u => u.DistanceUnit)
                .HasColumnType("varchar(2)")
                .HasDefaultValue(UserPreferences.Km)
                .IsRequired();

            builder.Property(u => u.VolumeUnit)
                .HasColumnType("varchar(3)")
                .HasDefaultValue(UserPreferences.Liter)
                .IsRequired();

            builder.Property(u => u.ConsumptionUnit)
                .HasColumnType("varchar(10)")
                .HasDefaultValue(UserPreferences.LitersPer100Km)
                .IsRequired();
        }
    }
}
