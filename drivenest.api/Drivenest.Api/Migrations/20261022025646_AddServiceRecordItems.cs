using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Drivenest.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddServiceRecordItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ServiceRecordItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ServiceRecordId = table.Column<int>(type: "int", nullable: false),
                    CategoryId = table.Column<int>(type: "int", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(12,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceRecordItems", x => x.Id);
                    table.CheckConstraint("CK_ServiceRecordItems_Amount", "[Amount] >= 0");
                    table.ForeignKey(
                        name: "FK_ServiceRecordItems_ServiceCategories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "ServiceCategories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ServiceRecordItems_ServiceRecords_ServiceRecordId",
                        column: x => x.ServiceRecordId,
                        principalTable: "ServiceRecords",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRecordItems_CategoryId",
                table: "ServiceRecordItems",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRecordItems_ServiceRecordId_CategoryId",
                table: "ServiceRecordItems",
                columns: new[] { "ServiceRecordId", "CategoryId" },
                unique: true);

            // A meglévő szervizek egy tételt kapnak a régi típusukkal és összegükkel, így nem vész el adat.
            migrationBuilder.Sql(
                "INSERT INTO ServiceRecordItems (ServiceRecordId, CategoryId, Amount) SELECT Id, CategoryId, Amount FROM ServiceRecords");

            migrationBuilder.DropForeignKey(
                name: "FK_ServiceRecords_ServiceCategories_CategoryId",
                table: "ServiceRecords");

            migrationBuilder.DropIndex(
                name: "IX_ServiceRecords_CategoryId",
                table: "ServiceRecords");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ServiceRecords_Amount",
                table: "ServiceRecords");

            migrationBuilder.DropColumn(
                name: "Amount",
                table: "ServiceRecords");

            migrationBuilder.DropColumn(
                name: "CategoryId",
                table: "ServiceRecords");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Amount",
                table: "ServiceRecords",
                type: "decimal(12,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "CategoryId",
                table: "ServiceRecords",
                type: "int",
                nullable: false,
                defaultValue: 0);

            // Visszaállításnál a szerviz típusa az első tétel típusa, az összege a tételek összege lesz.
            // Ha valamelyiknek nincs tétele, a 8-as ("Szervíz költség") típust kapja.
            migrationBuilder.Sql(@"
                UPDATE s SET
                    s.CategoryId = COALESCE((SELECT TOP 1 i.CategoryId FROM ServiceRecordItems i WHERE i.ServiceRecordId = s.Id ORDER BY i.Id), 8),
                    s.Amount = COALESCE((SELECT SUM(i.Amount) FROM ServiceRecordItems i WHERE i.ServiceRecordId = s.Id), 0)
                FROM ServiceRecords s");

            migrationBuilder.DropTable(
                name: "ServiceRecordItems");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRecords_CategoryId",
                table: "ServiceRecords",
                column: "CategoryId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ServiceRecords_Amount",
                table: "ServiceRecords",
                sql: "[Amount] >= 0");

            migrationBuilder.AddForeignKey(
                name: "FK_ServiceRecords_ServiceCategories_CategoryId",
                table: "ServiceRecords",
                column: "CategoryId",
                principalTable: "ServiceCategories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
