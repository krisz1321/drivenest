# Refueling API

Requires `Authorization: Bearer <token>`. Only the owner of the parent vehicle
can access its refuelings, including when the signed-in account is an admin.

| Method | Path | Success |
| --- | --- | --- |
| GET | /api/vehicles/{vehicleId}/refuelings | 200, array ordered by date, mileage, and ID descending |
| GET | /api/vehicles/{vehicleId}/refuelings/{id} | 200, refueling |
| POST | /api/vehicles/{vehicleId}/refuelings | 201, refueling and Location header |
| PUT | /api/vehicles/{vehicleId}/refuelings/{id} | 200, updated refueling |
| DELETE | /api/vehicles/{vehicleId}/refuelings/{id} | 204 |

POST and PUT use the same full body:

```json
{
  "date": "2026-10-15",
  "odometerKm": 55000,
  "liters": 42.125,
  "totalAmount": 25000.50,
  "isFullTank": true
}
```

Date must be provided as an ISO date. Mileage is a nonnegative integer.
Liters must be positive, up to 999999.999, with at most three decimal places.
Total amount may be zero, up to 9999999999.99, with at most two decimal places.
The amount uses the account's currency convention; no conversion is performed.
`isFullTank` defaults to true if omitted and supports explicit false.

Responses also include `id`, `vehicleId`, and the server-assigned UTC `createdAt`.
Vehicle ownership, record assignment, and creation time cannot be supplied or
changed through the request. PUT cannot move a refueling to another vehicle.

Unknown vehicles, other owners' vehicles, and a refueling ID belonging to a
different vehicle all return 404. An owned vehicle without refuelings returns
an empty array. Validation failures return 400; detected database conflicts
return 409. Concurrent edits have no version token and use last-write-wins
behavior unless the row was deleted before saving.

Refueling mileage is historical data. CRUD operations do not change the
vehicle's `CurrentKm`, enforce chronological mileage ordering, or compute fuel
consumption. Historical records can be entered or corrected independently.
No schema migration is required. No frontend changes are included.

Run the smoke checks from the backend repository:

```sh
dotnet run --project tests/RefuelingSmoke
```

Tests use an isolated in-memory database; JWT middleware and SQL Server
constraints still need integration testing against a running API.
