using Drivenest.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Drivenest.Api.Data.Configurations
{
    public class ExpenseCategoryConfiguration : IEntityTypeConfiguration<ExpenseCategory>
    {
        public void Configure(EntityTypeBuilder<ExpenseCategory> builder)
        {
            builder.ToTable("ExpenseCategories");

            builder.Property(x => x.Name)
                .HasMaxLength(100)
                .IsRequired();

            // Saját kategóriáknál a név felhasználónként legyen egyedi.
            // SQL Serveren a NULL UserId-k is egyenlőnek számítanak, így a beépített nevek is egyediek maradnak.
            // Az EF alapból "[UserId] IS NOT NULL" szűrőt tenne rá, azt kikapcsoljuk.
            builder.HasIndex(x => new { x.UserId, x.Name })
                .IsUnique()
                .HasFilter(null);

            builder.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // A Drivvo költségtípusai. A régi Id-kat megtartottuk (csak átneveztük őket),
            // így a már rögzített kiadások kategóriája nem vész el.
            builder.HasData(
                new ExpenseCategory { Id = 1, Name = "Biztosítás" },
                new ExpenseCategory { Id = 2, Name = "Autópálya matrica" },
                new ExpenseCategory { Id = 3, Name = "Autó" },
                new ExpenseCategory { Id = 4, Name = "Autómosó" },
                new ExpenseCategory { Id = 5, Name = "Parkolás" },
                new ExpenseCategory { Id = 6, Name = "Vásárlás" },
                new ExpenseCategory { Id = 7, Name = "Útdíjak" },
                new ExpenseCategory { Id = 8, Name = "Bírság" },
                new ExpenseCategory { Id = 9, Name = "Finanszírozás" },
                new ExpenseCategory { Id = 10, Name = "Regisztráció" },
                new ExpenseCategory { Id = 11, Name = "Eredetiség vizsga" },
                new ExpenseCategory { Id = 12, Name = "Műszaki" },
                new ExpenseCategory { Id = 13, Name = "Műszaki vizsga" },
                new ExpenseCategory { Id = 14, Name = "Olajcsere" },
                new ExpenseCategory { Id = 15, Name = "Törzskönyv" },
                new ExpenseCategory { Id = 16, Name = "Visszafizetés" },
                new ExpenseCategory { Id = 17, Name = "Átruházási Illeték" },
                new ExpenseCategory { Id = 18, Name = "Új forgalmi" });
        }
    }
}
