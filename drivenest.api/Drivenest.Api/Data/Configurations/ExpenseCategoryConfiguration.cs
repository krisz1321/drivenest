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

            builder.HasData(
                new ExpenseCategory { Id = 1, Name = "Biztosítás" },
                new ExpenseCategory { Id = 2, Name = "Autópálya-matrica" },
                new ExpenseCategory { Id = 3, Name = "Adó" },
                new ExpenseCategory { Id = 4, Name = "Mosás" },
                new ExpenseCategory { Id = 5, Name = "Parkolás" },
                new ExpenseCategory { Id = 6, Name = "Egyéb" },
                new ExpenseCategory { Id = 7, Name = "Útdíj" },
                new ExpenseCategory { Id = 8, Name = "Bírság" },
                new ExpenseCategory { Id = 9, Name = "Finanszírozás / hitel" },
                new ExpenseCategory { Id = 10, Name = "Forgalmi / regisztráció" },
                new ExpenseCategory { Id = 11, Name = "Tartozék" });
        }
    }
}
