using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Drivenest.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddImportSource : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ImportSource",
                table: "ServiceRecords",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ImportSource",
                table: "Refuelings",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ImportSource",
                table: "Expenses",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ImportSource",
                table: "AuditLogs",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ImportSource",
                table: "ServiceRecords");

            migrationBuilder.DropColumn(
                name: "ImportSource",
                table: "Refuelings");

            migrationBuilder.DropColumn(
                name: "ImportSource",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "ImportSource",
                table: "AuditLogs");
        }
    }
}
