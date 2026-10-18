using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Drivenest.Api.Migrations
{
    /// <inheritdoc />
    public partial class SimplifyServiceRecordCost : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Amount",
                table: "ServiceRecords",
                type: "decimal(12,2)",
                nullable: false,
                defaultValue: 0m);

            // A régi alkatrész + munkadíj összege lesz az új összeg, így nem vész el adat.
            migrationBuilder.Sql("UPDATE ServiceRecords SET Amount = PartsCost + LaborCost");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ServiceRecords_LaborCost",
                table: "ServiceRecords");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ServiceRecords_PartsCost",
                table: "ServiceRecords");

            migrationBuilder.DropIndex(
                name: "IX_ServiceCategories_Name",
                table: "ServiceCategories");

            migrationBuilder.DropColumn(
                name: "LaborCost",
                table: "ServiceRecords");

            migrationBuilder.DropColumn(
                name: "PartsCost",
                table: "ServiceRecords");

            migrationBuilder.AddColumn<int>(
                name: "UserId",
                table: "ServiceCategories",
                type: "int",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "ServiceCategories",
                keyColumn: "Id",
                keyValue: 1,
                column: "UserId",
                value: null);

            migrationBuilder.UpdateData(
                table: "ServiceCategories",
                keyColumn: "Id",
                keyValue: 2,
                column: "UserId",
                value: null);

            migrationBuilder.UpdateData(
                table: "ServiceCategories",
                keyColumn: "Id",
                keyValue: 3,
                column: "UserId",
                value: null);

            migrationBuilder.UpdateData(
                table: "ServiceCategories",
                keyColumn: "Id",
                keyValue: 4,
                column: "UserId",
                value: null);

            migrationBuilder.UpdateData(
                table: "ServiceCategories",
                keyColumn: "Id",
                keyValue: 5,
                column: "UserId",
                value: null);

            migrationBuilder.UpdateData(
                table: "ServiceCategories",
                keyColumn: "Id",
                keyValue: 6,
                column: "UserId",
                value: null);

            migrationBuilder.UpdateData(
                table: "ServiceCategories",
                keyColumn: "Id",
                keyValue: 7,
                column: "UserId",
                value: null);

            migrationBuilder.UpdateData(
                table: "ServiceCategories",
                keyColumn: "Id",
                keyValue: 8,
                column: "UserId",
                value: null);

            migrationBuilder.UpdateData(
                table: "ServiceCategories",
                keyColumn: "Id",
                keyValue: 9,
                column: "UserId",
                value: null);

            migrationBuilder.AddCheckConstraint(
                name: "CK_ServiceRecords_Amount",
                table: "ServiceRecords",
                sql: "[Amount] >= 0");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceCategories_UserId_Name",
                table: "ServiceCategories",
                columns: new[] { "UserId", "Name" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ServiceCategories_Users_UserId",
                table: "ServiceCategories",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ServiceCategories_Users_UserId",
                table: "ServiceCategories");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ServiceRecords_Amount",
                table: "ServiceRecords");

            migrationBuilder.DropIndex(
                name: "IX_ServiceCategories_UserId_Name",
                table: "ServiceCategories");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "ServiceCategories");

            migrationBuilder.AddColumn<decimal>(
                name: "LaborCost",
                table: "ServiceRecords",
                type: "decimal(12,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "PartsCost",
                table: "ServiceRecords",
                type: "decimal(12,2)",
                nullable: false,
                defaultValue: 0m);

            // Visszaállításnál az egész összeg alkatrészként kerül vissza.
            migrationBuilder.Sql("UPDATE ServiceRecords SET PartsCost = Amount");

            migrationBuilder.DropColumn(
                name: "Amount",
                table: "ServiceRecords");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ServiceRecords_LaborCost",
                table: "ServiceRecords",
                sql: "[LaborCost] >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ServiceRecords_PartsCost",
                table: "ServiceRecords",
                sql: "[PartsCost] >= 0");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceCategories_Name",
                table: "ServiceCategories",
                column: "Name",
                unique: true);
        }
    }
}
