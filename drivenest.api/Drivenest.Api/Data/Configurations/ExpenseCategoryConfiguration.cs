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

            builder.HasIndex(x => x.Name)
                .IsUnique();

            builder.HasData(
                new ExpenseCategory { Id = 1, Name = "Biztosítás" },
                new ExpenseCategory { Id = 2, Name = "Autópálya-matrica" },
                new ExpenseCategory { Id = 3, Name = "Adó" },
                new ExpenseCategory { Id = 4, Name = "Mosás" },
                new ExpenseCategory { Id = 5, Name = "Parkolás" },
                new ExpenseCategory { Id = 6, Name = "Egyéb" });
        }
    }
}
