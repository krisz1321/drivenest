# Vehicle API

The `OwnVehicles` API exposes all five operations at `/api/ownvehicles` and
`/api/ownvehicles/{id}`. It derives ownership from the authenticated token,
including for administrators. POST automatically assigns the vehicle to that
user; PUT cannot transfer ownership. Other users' vehicle IDs return 404.
It appears as **OwnVehicles** in Swagger.

The existing `/api/vehicles` routes remain available with the same ownership
restrictions. Both controllers share the same CRUD implementation.

All endpoints require `Authorization: Bearer <token>`. Each user can access only
their own vehicles. Missing vehicles and vehicles owned by someone else return 404.

| Method | Path | Success |
| --- | --- | --- |
| GET | /api/vehicles | 200 with an array (empty if none) |
| GET | /api/vehicles/{id} | 200 with a vehicle |
| POST | /api/vehicles | 201 with a vehicle and Location header |
| PUT | /api/vehicles/{id} | 200 with the updated vehicle |
| DELETE | /api/vehicles/{id} | 204 |

POST and PUT accept the same full request body:

```json
{
  "fuelTypeId": 1,
  "licensePlate": "ABC-123",
  "vin": null,
  "make": "Suzuki",
  "model": "Swift",
  "year": 2020,
  "initialKm": 50000,
  "currentKm": 55000
}
```

Responses contain these fields plus `id`. Ownership comes from the token.
Use GET /api/lookups/fuel-types to obtain valid fuel type IDs.

License plate (max 20), make (max 50), and model (max 50) are required.
Plates and VINs are converted to uppercase; surrounding whitespace is removed
from plates, make, and model. VIN is optional and must contain 17 ASCII letters
or digits when supplied. Year is optional, between 1886 and 2100. Mileage must
be nonnegative, and current mileage must be at least initial mileage.

Invalid fields, nonexistent fuel types, and duplicate plates for the same user
return 400 validation problem details. Concurrent database conflicts return 409.
Deleting a vehicle with refuelings, service records, expenses, or reminders returns
409; remove the linked records first. Linked records are never deleted implicitly.

## Verification

From the backend repository:

```sh
dotnet build Drivenest.Api/Drivenest.Api.csproj
dotnet run --project tests/VehicleSmoke
```

The smoke checks use an isolated EF Core in-memory database. They cover CRUD,
ownership filtering, duplicate plates, invalid fuel types, field validation, and
linked-record deletion protection. They do not exercise JWT middleware or SQL
Server constraints; verify those against a configured running API using Swagger.
