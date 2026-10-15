using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Drivenest.Api.Controllers;
using Drivenest.Api.Data;
using Drivenest.Api.Data.Entities;
using Drivenest.Api.Dtos.Vehicles;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Mvc.Infrastructure;

// Run with: dotnet run --project tests/VehicleSmoke
// Uses an isolated in-memory database; SQL constraints and JWT middleware need integration testing.
await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
    .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
db.FuelTypes.Add(new FuelType { Id = 1, Name = "Petrol" });
db.Vehicles.Add(new Vehicle { Id = 100, UserId = 2, FuelTypeId = 1, LicensePlate = "OTHER" });
await db.SaveChangesAsync();
var controller = new OwnVehiclesController(db)
{
    ControllerContext = new ControllerContext
    {
        HttpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim("sub", "1") }, "Test"))
        }
    }
};
var ct = CancellationToken.None;
var services = new ServiceCollection();
services.AddLogging();
services.AddControllers();
using var provider = services.BuildServiceProvider();
controller.ProblemDetailsFactory = provider.GetRequiredService<ProblemDetailsFactory>();
controller.HttpContext.RequestServices = provider;
void Check(bool condition, string name)
{
    if (!condition) throw new Exception(name);
    Console.WriteLine($"PASS: {name}");
}
VehicleRequest Request(string plate = "abc-123") => new()
{
    FuelTypeId = 1, LicensePlate = plate, Make = " Suzuki ", Model = " Swift ",
    Year = 2020, InitialKm = 100, CurrentKm = 200
};
Check(Attribute.IsDefined(typeof(OwnVehiclesController), typeof(AuthorizeAttribute)), "Authentication required");
var created = (await controller.Create(Request(), ct)).Result as CreatedAtActionResult;
var dto = created?.Value as VehicleDto;
Check(dto is { LicensePlate: "ABC-123", Make: "Suzuki", Model: "Swift" }
    && created!.ActionName == nameof(VehiclesController.GetById), "Create normalizes fields and returns resource location");
int id = dto!.Id;
Check((await db.Vehicles.FindAsync(id))!.UserId == 1, "Create assigns ownership to the logged-in user");
Check((await controller.GetAll(ct)).Value is { Count: 1 }, "List excludes other users' vehicles");
Check((await controller.GetById(100, ct)).Result is NotFoundResult, "Read hides another owner's vehicle");
Check((await controller.Update(100, Request(), ct)).Result is NotFoundResult, "Update blocks another owner");
Check(await controller.Delete(100, ct) is NotFoundResult, "Delete blocks another owner");
Check((await db.Vehicles.FindAsync(100))!.LicensePlate == "OTHER", "Forbidden operations leave the other vehicle unchanged");
controller.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity(new[]
{
    new Claim("sub", "1"), new Claim(ClaimTypes.Role, "Admin")
}, "Test"));
Check((await controller.GetAll(ct)).Value is { Count: 1 }
    && (await controller.GetById(100, ct)).Result is NotFoundResult,
    "Admin users are also restricted to their own vehicles");
var updated = (await controller.Update(id, Request("new-123"), ct)).Result as OkObjectResult;
Check(updated?.Value is VehicleDto { LicensePlate: "NEW-123" }, "Update persists vehicle fields");
var duplicate = (await controller.Create(Request("new-123"), ct)).Result;
Check(duplicate is ObjectResult { StatusCode: 400 }, "Duplicate plate rejected");
controller.ModelState.Clear();
var invalidFuel = Request("unique");
invalidFuel.FuelTypeId = 999;
Check((await controller.Create(invalidFuel, ct)).Result is ObjectResult { StatusCode: 400 }, "Unknown fuel type rejected");
controller.ModelState.Clear();
var invalid = Request();
invalid.CurrentKm = 99;
Check(!Validator.TryValidateObject(invalid, new ValidationContext(invalid), new List<ValidationResult>(), true), "Mileage validation");
invalid = Request();
invalid.Make = " ";
Check(!Validator.TryValidateObject(invalid, new ValidationContext(invalid), new List<ValidationResult>(), true), "Blank required field rejected");
db.Reminders.Add(new Reminder { VehicleId = id });
await db.SaveChangesAsync();
Check(await controller.Delete(id, ct) is ObjectResult { StatusCode: 409 }, "Linked records block deletion");
db.Reminders.RemoveRange(db.Reminders);
await db.SaveChangesAsync();
Check(await controller.Delete(id, ct) is NoContentResult, "Delete succeeds without linked records");
Check((await controller.GetById(id, ct)).Result is NotFoundResult, "Deleted vehicle is unavailable");
