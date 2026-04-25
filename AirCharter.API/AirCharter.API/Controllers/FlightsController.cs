using AirCharter.API.Model;
using AirCharter.API.Requests.Flights;
using AirCharter.API.Responses.Flights;
using AirCharter.API.Services;
using AirCharter.API.Services.Routing;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AirCharter.API.Controllers;

[ApiController]
[Route("flights")]
public sealed class FlightsController(
    AirCharterExtendedContext context,
    AirportGraphCache airportGraphCache,
    RoutePlanningService routePlanningService) : ControllerBase
{
    private readonly AirCharterExtendedContext _context = context;
    private readonly AirportGraphCache _airportGraphCache = airportGraphCache;
    private readonly RoutePlanningService _routePlanningService = routePlanningService;

    [HttpPost("catalog-planes")]
    public async Task<IActionResult> GetCatalogPlanes(
        [FromBody] PlaneCatalogRequest request,
        CancellationToken cancellationToken)
    {
        AirportGraph airportGraph = await _airportGraphCache.GetOrCreateAsync(
            _context,
            cancellationToken);

        if (!airportGraph.ContainsAirport(request.TakeOffAirportId))
            return NotFound("Take-off airport not found.");

        if (!airportGraph.ContainsAirport(request.LandingAirportId))
            return NotFound("Landing airport not found.");

        List<Plane> planes = await _context.Planes
            .Include(plane => plane.Airline)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        IReadOnlyCollection<PlaneCatalogResponse> planeCatalogResponses =
            _routePlanningService.CalculateCatalog(
                planes,
                airportGraph,
                request.TakeOffAirportId,
                request.LandingAirportId);

        return Ok(planeCatalogResponses);
    }
}