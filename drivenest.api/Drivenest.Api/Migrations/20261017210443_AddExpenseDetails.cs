using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Drivenest.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddExpenseDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Expenses_VehicleId",
                table: "Expenses");

            migrationBuilder.DropIndex(
                name: "IX_ExpenseCategories_Name",
                table: "ExpenseCategories");

            migrationBuilder.AddColumn<string>(
                name: "Location",
                table: "Expenses",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OdometerKm",
                table: "Expenses",
                type: "int",
                nullable: false,
                defaultValue: 0);

            // A korábbi kiadásoknál nem volt km, ezért a jármű kezdő km-ét kapják meg.
            migrationBuilder.Sql(
                "UPDATE e SET e.OdometerKm = v.InitialKm FROM Expenses e JOIN Vehicles v ON v.Id = e.VehicleId");

            migrationBuilder.AddColumn<int>(
                name: "UserId",
                table: "ExpenseCategories",
                type: "int",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 1,
                column: "UserId",
                value: null);

            migrationBuilder.UpdateData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 2,
                column: "UserId",
                value: null);

            migrationBuilder.UpdateData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 3,
                column: "UserId",
                value: null);

            migrationBuilder.UpdateData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 4,
                column: "UserId",
                value: null);

            migrationBuilder.UpdateData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 5,
                column: "UserId",
                value: null);

            migrationBuilder.UpdateData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 6,
                column: "UserId",
                value: null);

            migrationBuilder.InsertData(
                table: "ExpenseCategories",
                columns: new[] { "Id", "Name", "UserId" },
                values: new object[,]
                {
                    { 7, "Útdíj", null },
                    { 8, "Bírság", null },
                    { 9, "Finanszírozás / hitel", null },
                    { 10, "Forgalmi / regisztráció", null },
                    { 11, "Tartozék", null }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_VehicleId_Date",
                table: "Expenses",
                columns: new[] { "VehicleId", "Date" },
                descending: new[] { false, true });

            migrationBuilder.AddCheckConstraint(
                name: "CK_Expenses_OdometerKm",
                table: "Expenses",
                sql: "[OdometerKm] >= 0");

            migrationBuilder.CreateIndex(
                name: "IX_ExpenseCategories_UserId_Name",
                table: "ExpenseCategories",
                columns: new[] { "UserId", "Name" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ExpenseCategories_Users_UserId",
                table: "ExpenseCategories",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ExpenseCategories_Users_UserId",
                table: "ExpenseCategories");

            migrationBuilder.DropIndex(
                name: "IX_Expenses_VehicleId_Date",
                table: "Expenses");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Expenses_OdometerKm",
                table: "Expenses");

            migrationBuilder.DropIndex(
                name: "IX_ExpenseCategories_UserId_Name",
                table: "ExpenseCategories");

            migrationBuilder.DeleteData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 7);

            migrationBuilder.DeleteData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 8);

            migrationBuilder.DeleteData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 9);

            migrationBuilder.DeleteData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 10);

            migrationBuilder.DeleteData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 11);

            migrationBuilder.DropColumn(
                name: "Location",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "OdometerKm",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "ExpenseCategories");

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_VehicleId",
                table: "Expenses",
                column: "VehicleId");

            migrationBuilder.CreateIndex(
                name: "IX_ExpenseCategories_Name",
                table: "ExpenseCategories",
                column: "Name",
                unique: true);
        }
    }
}
