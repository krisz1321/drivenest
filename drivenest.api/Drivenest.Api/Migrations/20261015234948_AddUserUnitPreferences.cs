using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Drivenest.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUserUnitPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ConsumptionUnit",
                table: "Users",
                type: "varchar(10)",
                nullable: false,
                defaultValue: "l/100km");

            migrationBuilder.AddColumn<string>(
                name: "DistanceUnit",
                table: "Users",
                type: "varchar(2)",
                nullable: false,
                defaultValue: "km");

            migrationBuilder.AddColumn<string>(
                name: "VolumeUnit",
                table: "Users",
                type: "varchar(3)",
                nullable: false,
                defaultValue: "l");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Users_ConsumptionUnit",
                table: "Users",
                sql: "[ConsumptionUnit] IN ('l/100km', 'km/l', 'mpg')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Users_DistanceUnit",
                table: "Users",
                sql: "[DistanceUnit] IN ('km', 'mi')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Users_VolumeUnit",
                table: "Users",
                sql: "[VolumeUnit] IN ('l', 'gal')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Users_ConsumptionUnit",
                table: "Users");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Users_DistanceUnit",
                table: "Users");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Users_VolumeUnit",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ConsumptionUnit",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "DistanceUnit",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "VolumeUnit",
                table: "Users");
        }
    }
}
