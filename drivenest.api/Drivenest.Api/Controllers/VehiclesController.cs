using Drivenest.Api.Data;
using Microsoft.AspNetCore.Mvc;

namespace Drivenest.Api.Controllers;

[Route("api/vehicles")]
public class VehiclesController : VehicleCrudControllerBase
{
    public VehiclesController(AppDbContext db) : base(db) { }
}
