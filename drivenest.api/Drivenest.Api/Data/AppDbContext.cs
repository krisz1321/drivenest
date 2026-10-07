using Drivenest.Api.Data.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Drivenest.Api.Data
{
    public class AppDbContext : IdentityDbContext<ApplicationUser, IdentityRole<int>, int>
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<FuelType> FuelTypes => Set<FuelType>();

        public DbSet<ServiceCategory> ServiceCategories => Set<ServiceCategory>();

        public DbSet<ExpenseCategory> ExpenseCategories => Set<ExpenseCategory>();

        public DbSet<Vehicle> Vehicles => Set<Vehicle>();

        public DbSet<Refueling> Refuelings => Set<Refueling>();

        public DbSet<ServiceRecord> ServiceRecords => Set<ServiceRecord>();

        public DbSet<Expense> Expenses => Set<Expense>();

        public DbSet<Reminder> Reminders => Set<Reminder>();

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            builder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
        }
    }
}
