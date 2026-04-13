using AirCharter.API.Model;
using AirCharter.API.Requests.Departures;
using AirCharter.API.Responses.Departures;
using AirCharter.API.Responses.Flights;
using AirCharter.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AirCharter.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("departures")]
    public class DeparturesController(AirCharterExtendedContext context, FlightCalculationService flightCalculationService) : ControllerBase
    {
        private readonly AirCharterExtendedContext _context = context;
        private readonly FlightCalculationService _flightCalculationService = flightCalculationService;

        [HttpPost("create-order")]
        public async Task<IActionResult> CreateOrder(CreateDepartureRequest createDepartureRequest, CancellationToken cancellationToken)
        {
            Claim? userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);

            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
                return Unauthorized();
            User? user = await _context.Users
                .Include(user => user.Person)
                .FirstOrDefaultAsync(user => user.Id == userId, cancellationToken);

            if (user == null)
                return Unauthorized();

            if (createDepartureRequest.TakeOffAirportId == createDepartureRequest.LandingAirportId)
                return BadRequest("The landing airport and the take off airport must not be the same.");

            Plane? plane = await _context.Planes
                .Include(currentPlane => currentPlane.Airline)
                .FirstOrDefaultAsync(
                    currentPlane => currentPlane.Id == createDepartureRequest.PlaneId,
                    cancellationToken);

            if (plane == null)
                return NotFound("Plane not found.");

            Airport? takeOffAirport = await _context.Airports
                .FirstOrDefaultAsync(
                    airport => airport.Id == createDepartureRequest.TakeOffAirportId,
                    cancellationToken);

            if (takeOffAirport == null)
                return NotFound("Take off airport not found.");

            Airport? landingAirport = await _context.Airports
                .FirstOrDefaultAsync(
                    airport => airport.Id == createDepartureRequest.LandingAirportId,
                    cancellationToken);

            if (landingAirport == null)
                return NotFound("Landing airport not found.");

            FlightCalculationResponse calculation = _flightCalculationService.CalculateFlight(plane, takeOffAirport, landingAirport);

            Departure departure = new()
            {
                CharterRequesterId = user.Id,
                PlaneId = createDepartureRequest.PlaneId,
                TakeOffAirportId = createDepartureRequest.TakeOffAirportId,
                LandingAirportId = createDepartureRequest.LandingAirportId,
                RequestedTakeOffDateTime = createDepartureRequest.RequestedTakeOffDateTime,
                Distance = calculation.DistanceKm,
                FlightTime = calculation.FlightTime,
                Price = calculation.FlightCost,
                Transfers = calculation.NumberOfTransfers
            };

            departure.DepartureStatuses.Add(new DepartureStatus()
            {
                StatusId = _context.Statuses.Min(s => s.Id),
                StatusSettingDateTime = DateTime.UtcNow
            });

            departure.People.Add(user.Person!);

            _context.Departures.Add(departure);
            await _context.SaveChangesAsync(cancellationToken);

            return NoContent();
        }

        [HttpPost("calculate-cost")]
        public async Task<ActionResult<FlightCostResponse>> CalculateCost(FlightCostRequest request, CancellationToken cancellationToken)
        {
            if (request.TakeOffAirportId == request.LandingAirportId)
                return BadRequest("The landing airport and the take off airport must not be the same.");

            Plane? plane = await _context.Planes
                .Include(currentPlane => currentPlane.Airline)
                .FirstOrDefaultAsync(currentPlane => currentPlane.Id == request.PlaneId, cancellationToken);

            if (plane == null)
                return NotFound("Plane not found.");

            Airport? takeOffAirport = await _context.Airports
                .FirstOrDefaultAsync(airport => airport.Id == request.TakeOffAirportId, cancellationToken);

            if (takeOffAirport == null)
                return NotFound("Take off airport not found.");

            Airport? landingAirport = await _context.Airports
                .FirstOrDefaultAsync(airport => airport.Id == request.LandingAirportId, cancellationToken);

            if (landingAirport == null)
                return NotFound("Landing airport not found.");

            FlightCalculationResponse calculation = _flightCalculationService.CalculateFlight(
                plane,
                takeOffAirport,
                landingAirport);

            FlightCostResponse response = new()
            {
                Cost = calculation.FlightCost
            };

            return Ok(response);
        }
    }
}
