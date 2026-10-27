using Drivenest.Api.Data;
using Microsoft.AspNetCore.Mvc;

namespace Drivenest.Api.Controllers;

/// <summary>Manages only vehicles assigned to the authenticated user.</summary>
[Route("api/ownvehicles")]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
public class OwnVehiclesController : VehicleCrudControllerBase
{
    public OwnVehiclesController(AppDbContext db) : base(db) { }
}
