using AirCharter.API.Model;
using AirCharter.API.Requests.Flights;
using AirCharter.API.Responses.Flights;
using AirCharter.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AirCharter.API.Controllers;

[ApiController]
[Route("flights")]
public sealed class FlightsController(
    AirCharterExtendedContext context,
    RoutePlanningService routePlanningService) : ControllerBase
{
    private readonly AirCharterExtendedContext _context = context;
    private readonly RoutePlanningService _routePlanningService = routePlanningService;

    [HttpPost("catalog-planes")]
    public async Task<IActionResult> GetCatalogPlanes(
        [FromBody] PlaneCatalogRequest request,
        CancellationToken cancellationToken)
    {
        Airport? takeOffAirport = await _context.Airports
            .AsNoTracking()
            .FirstOrDefaultAsync(
                airport => airport.Id == request.TakeOffAirportId,
                cancellationToken);

        if (takeOffAirport is null)
            return NotFound("Take-off airport not found.");

        Airport? landingAirport = await _context.Airports
            .AsNoTracking()
            .FirstOrDefaultAsync(
                airport => airport.Id == request.LandingAirportId,
                cancellationToken);

        if (landingAirport is null)
            return NotFound("Landing airport not found.");

        List<Airport> airports = await _context.Airports
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        List<Plane> planes = await _context.Planes
            .Include(plane => plane.Airline)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        List<PlaneCatalogResponse> planeCatalogResponses = planes
            .Select(plane => _routePlanningService.Calculate(
                plane,
                takeOffAirport,
                landingAirport,
                airports))
            .ToList();

        return Ok(planeCatalogResponses);
    }
}