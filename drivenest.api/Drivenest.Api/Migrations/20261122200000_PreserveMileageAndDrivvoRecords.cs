using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Drivenest.Api.Migrations
{
    public partial class PreserveMileageAndDrivvoRecords : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ManualCurrentKm", table: "Vehicles", type: "int", nullable: false, defaultValue: 0);
            migrationBuilder.Sql("UPDATE [Vehicles] SET [ManualCurrentKm] = [CurrentKm];");
            migrationBuilder.AddCheckConstraint(
                name: "CK_Vehicles_ManualCurrentKm", table: "Vehicles",
                sql: "[ManualCurrentKm] >= [InitialKm] AND [CurrentKm] >= [ManualCurrentKm]");

            foreach (var table in new[] { "Expenses", "ServiceRecords" })
            {
                migrationBuilder.AddColumn<string>(
                    name: "ImportRecordKey", table: table, type: "varchar(64)",
                    unicode: false, maxLength: 64, nullable: true);
                migrationBuilder.CreateIndex(
                    name: $"IX_{table}_VehicleId_ImportRecordKey", table: table,
                    columns: new[] { "VehicleId", "ImportRecordKey" }, unique: true,
                    filter: "[ImportRecordKey] IS NOT NULL");
            }
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var table in new[] { "Expenses", "ServiceRecords" })
            {
                migrationBuilder.DropIndex(name: $"IX_{table}_VehicleId_ImportRecordKey", table: table);
                migrationBuilder.DropColumn(name: "ImportRecordKey", table: table);
            }

            migrationBuilder.DropCheckConstraint(name: "CK_Vehicles_ManualCurrentKm", table: "Vehicles");
            migrationBuilder.DropColumn(name: "ManualCurrentKm", table: "Vehicles");
        }
    }
}
