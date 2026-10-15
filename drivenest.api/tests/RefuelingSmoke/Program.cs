using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Drivenest.Api.Controllers;
using Drivenest.Api.Data;
using Drivenest.Api.Data.Entities;
using Drivenest.Api.Dtos.Refuelings;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
    .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
db.Vehicles.AddRange(
    new Vehicle { Id = 1, UserId = 1, CurrentKm = 50000 },
    new Vehicle { Id = 2, UserId = 2 },
    new Vehicle { Id = 3, UserId = 1 });
db.Refuelings.AddRange(
    new Refueling { Id = 100, VehicleId = 2, Date = new(2026, 10, 1), Liters = 20 },
    new Refueling { Id = 200, VehicleId = 3, Date = new(2026, 10, 1), Liters = 20 });
await db.SaveChangesAsync();
var clock = new FixedClock();
var services = new ServiceCollection();
services.AddLogging();
services.AddControllers();
using var provider = services.BuildServiceProvider();
var controller = new RefuelingsController(db, clock)
{
    ControllerContext = new ControllerContext
    {
        HttpContext = new DefaultHttpContext
        {
            RequestServices = provider,
            User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim("sub", "1") }, "Test"))
        }
    },
    ProblemDetailsFactory = provider.GetRequiredService<ProblemDetailsFactory>()
};
var ct = CancellationToken.None;
int passed = 0;
void Check(bool condition, string name)
{
    if (!condition) throw new Exception(name);
    passed++;
    Console.WriteLine($"PASS: {name}");
}
RefuelingRequest Request() => new()
{
    Date = new(2026, 10, 15), OdometerKm = 45000, Liters = 42.125m,
    TotalAmount = 25000.50m, IsFullTank = false
};
bool Valid(RefuelingRequest request) => Validator.TryValidateObject(request,
    new ValidationContext(request), new List<ValidationResult>(), true);

Check(Attribute.IsDefined(typeof(RefuelingsController), typeof(AuthorizeAttribute)), "Authentication is required");
Check((await controller.GetAll(1, ct)).Value is { Count: 0 }, "Owned vehicle starts with an empty list");
Check((await controller.GetAll(2, ct)).Result is NotFoundResult, "List hides another owner's vehicle");
Check((await controller.GetAll(999, ct)).Result is NotFoundResult, "Missing parent returns 404");
Check((await controller.Create(2, Request(), ct)).Result is NotFoundResult, "Create blocks another owner");
Check((await controller.Create(999, Request(), ct)).Result is NotFoundResult, "Create rejects missing parent");

var created = (await controller.Create(1, Request(), ct)).Result as CreatedAtActionResult;
var dto = created?.Value as RefuelingDto;
Check(created is { StatusCode: 201, ActionName: nameof(RefuelingsController.GetById) }
    && (int)created.RouteValues!["vehicleId"]! == 1 && dto is { VehicleId: 1, IsFullTank: false },
    "Create persists route assignment and explicit partial tank, with a resource location");
int id = dto!.Id;
Check(dto.CreatedAt == clock.GetUtcNow().UtcDateTime && dto.CreatedAt.Kind == DateTimeKind.Utc,
    "Creation time is supplied by the server in UTC");
Check((await controller.GetById(1, id, ct)).Result is OkObjectResult { Value: RefuelingDto { Liters: 42.125m } },
    "Read returns saved decimal values");
Check((await controller.GetById(2, 100, ct)).Result is NotFoundResult, "Read blocks another owner");
Check((await controller.GetById(1, 200, ct)).Result is NotFoundResult, "Read rejects record belonging to another owned car");
Check((await controller.Update(2, 100, Request(), ct)).Result is NotFoundResult, "Update blocks another owner");
Check((await controller.Update(1, 200, Request(), ct)).Result is NotFoundResult, "Update cannot reassign a record from another car");
Check(await controller.Delete(2, 100, ct) is NotFoundResult, "Delete blocks another owner");
Check(await controller.Delete(1, 200, ct) is NotFoundResult, "Delete rejects mismatched vehicle and record");

var update = Request();
update.Liters = 35.500m;
update.TotalAmount = 21000;
update.IsFullTank = true;
var updated = (await controller.Update(1, id, update, ct)).Result as OkObjectResult;
Check(updated?.Value is RefuelingDto { Liters: 35.500m, IsFullTank: true } result
    && result.CreatedAt == dto.CreatedAt && result.VehicleId == 1,
    "Update changes data without changing assignment or creation time");
var earlier = Request();
earlier.Date = new(2026, 10, 1);
await controller.Create(1, earlier, ct);
var list = (await controller.GetAll(1, ct)).Value!;
Check(list.Count == 2 && list[0].Id == id, "List includes only this vehicle and sorts newest first");

controller.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity(new[]
{
    new Claim("sub", "1"), new Claim(ClaimTypes.Role, "Admin")
}, "Test"));
Check((await controller.GetAll(2, ct)).Result is NotFoundResult, "Admin accounts are also ownership scoped");
Check(await controller.Delete(1, id, ct) is NoContentResult, "Delete succeeds for an owned record");
Check((await controller.GetById(1, id, ct)).Result is NotFoundResult, "Deleted refueling returns 404");
Check((await controller.Update(1, id, Request(), ct)).Result is NotFoundResult, "Updating deleted refueling returns 404");
Check(await controller.Delete(1, id, ct) is NotFoundResult, "Deleting missing refueling returns 404");
Check((await db.Vehicles.FindAsync(1))!.CurrentKm == 50000, "Historical CRUD preserves vehicle current mileage");
Check((await db.Refuelings.FindAsync(100))!.Liters == 20 && (await db.Refuelings.FindAsync(200))!.VehicleId == 3,
    "Forbidden operations leave other records unchanged");

Check(Valid(Request()), "Valid refueling passes validation");
var originalCulture = System.Globalization.CultureInfo.CurrentCulture;
try
{
    foreach (var locale in new[] { "hu-HU", "en-US" })
    {
        System.Globalization.CultureInfo.CurrentCulture = new(locale);
        Check(Valid(Request()), $"Decimal validation works under {locale}");
    }
}
finally { System.Globalization.CultureInfo.CurrentCulture = originalCulture; }
var invalid = Request(); invalid.Date = default;
Check(!Valid(invalid), "Date is required");
invalid = Request(); invalid.OdometerKm = -1;
Check(!Valid(invalid), "Negative mileage is rejected");
invalid = Request(); invalid.Liters = 0;
Check(!Valid(invalid), "Zero liters is rejected");
invalid = Request(); invalid.Liters = -1;
Check(!Valid(invalid), "Negative liters is rejected");
invalid = Request(); invalid.Liters = 1000000;
Check(!Valid(invalid), "Liters cannot overflow SQL decimal precision");
invalid = Request(); invalid.Liters = 1.1234m;
Check(!Valid(invalid), "Liters cannot silently lose fractional precision");
invalid = Request(); invalid.TotalAmount = -1;
Check(!Valid(invalid), "Negative total is rejected");
invalid = Request(); invalid.TotalAmount = 10000000000m;
Check(!Valid(invalid), "Total cannot overflow SQL decimal precision");
invalid = Request(); invalid.TotalAmount = 1.234m;
Check(!Valid(invalid), "Total cannot silently lose fractional precision");
var boundary = Request(); boundary.Liters = 999999.999m; boundary.TotalAmount = 9999999999.99m;
Check(Valid(boundary), "Maximum SQL decimal values are supported");
boundary.TotalAmount = 0; boundary.Liters = 0.001m;
Check(Valid(boundary), "Zero cost and minimum liters are supported");
Check(new RefuelingRequest().IsFullTank, "Full tank defaults to true");
Console.WriteLine($"All {passed} refueling checks passed.");

sealed class FixedClock : TimeProvider
{
    public override DateTimeOffset GetUtcNow() => new(2026, 10, 15, 12, 0, 0, TimeSpan.Zero);
}
