using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Drivenest.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddServiceReminderRelationship : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ReminderId",
                table: "ServiceRecords",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReminderTitle",
                table: "ServiceRecords",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsCompleted",
                table: "Reminders",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "Reminders",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRecords_ReminderId",
                table: "ServiceRecords",
                column: "ReminderId");

            migrationBuilder.AddForeignKey(
                name: "FK_ServiceRecords_Reminders_ReminderId",
                table: "ServiceRecords",
                column: "ReminderId",
                principalTable: "Reminders",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ServiceRecords_Reminders_ReminderId",
                table: "ServiceRecords");

            migrationBuilder.DropIndex(
                name: "IX_ServiceRecords_ReminderId",
                table: "ServiceRecords");

            migrationBuilder.DropColumn(
                name: "ReminderId",
                table: "ServiceRecords");

            migrationBuilder.DropColumn(
                name: "ReminderTitle",
                table: "ServiceRecords");

            migrationBuilder.DropColumn(
                name: "IsCompleted",
                table: "Reminders");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "Reminders");
        }
    }
}
