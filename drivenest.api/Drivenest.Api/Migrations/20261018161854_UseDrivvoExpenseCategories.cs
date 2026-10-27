using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Drivenest.Api.Migrations
{
    /// <inheritdoc />
    public partial class UseDrivvoExpenseCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 2,
                column: "Name",
                value: "Autópálya matrica");

            migrationBuilder.UpdateData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 3,
                column: "Name",
                value: "Autó");

            migrationBuilder.UpdateData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 4,
                column: "Name",
                value: "Autómosó");

            migrationBuilder.UpdateData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 6,
                column: "Name",
                value: "Vásárlás");

            migrationBuilder.UpdateData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 7,
                column: "Name",
                value: "Útdíjak");

            migrationBuilder.UpdateData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 9,
                column: "Name",
                value: "Finanszírozás");

            migrationBuilder.UpdateData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 10,
                column: "Name",
                value: "Regisztráció");

            migrationBuilder.UpdateData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 11,
                column: "Name",
                value: "Eredetiség vizsga");

            migrationBuilder.InsertData(
                table: "ExpenseCategories",
                columns: new[] { "Id", "Name", "UserId" },
                values: new object[,]
                {
                    { 12, "Műszaki", null },
                    { 13, "Műszaki vizsga", null },
                    { 14, "Olajcsere", null },
                    { 15, "Törzskönyv", null },
                    { 16, "Visszafizetés", null },
                    { 17, "Átruházási Illeték", null },
                    { 18, "Új forgalmi", null }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 12);

            migrationBuilder.DeleteData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 13);

            migrationBuilder.DeleteData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 14);

            migrationBuilder.DeleteData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 15);

            migrationBuilder.DeleteData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 16);

            migrationBuilder.DeleteData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 17);

            migrationBuilder.DeleteData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 18);

            migrationBuilder.UpdateData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 2,
                column: "Name",
                value: "Autópálya-matrica");

            migrationBuilder.UpdateData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 3,
                column: "Name",
                value: "Adó");

            migrationBuilder.UpdateData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 4,
                column: "Name",
                value: "Mosás");

            migrationBuilder.UpdateData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 6,
                column: "Name",
                value: "Egyéb");

            migrationBuilder.UpdateData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 7,
                column: "Name",
                value: "Útdíj");

            migrationBuilder.UpdateData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 9,
                column: "Name",
                value: "Finanszírozás / hitel");

            migrationBuilder.UpdateData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 10,
                column: "Name",
                value: "Forgalmi / regisztráció");

            migrationBuilder.UpdateData(
                table: "ExpenseCategories",
                keyColumn: "Id",
                keyValue: 11,
                column: "Name",
                value: "Tartozék");
        }
    }
}
