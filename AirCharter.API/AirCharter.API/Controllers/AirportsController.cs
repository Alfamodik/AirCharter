using AirCharter.API.Responses.Airports;
using AirCharter.API.Services;
using Microsoft.AspNetCore.Mvc;

namespace AirCharter.API.Controllers
{
    [Route("airports")]
    [ApiController]
    public sealed class AirportsController(AirportSearchService airportSearchService) : ControllerBase
    {
        private readonly AirportSearchService _airportSearchService = airportSearchService;

        [HttpGet("search")]
        public async Task<ActionResult<IReadOnlyCollection<AirportSearchResponse>>> SearchAirports(
            [FromQuery] string query,
            [FromQuery] int limit = 10,
            CancellationToken cancellationToken = default)
        {
            IReadOnlyCollection<AirportSearchResponse> airports =
                await _airportSearchService.SearchAsync(query, limit, cancellationToken);

            return Ok(airports);
        }
    }
}