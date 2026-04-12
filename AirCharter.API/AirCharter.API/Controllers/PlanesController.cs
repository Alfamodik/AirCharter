using AirCharter.API.Model;
using AirCharter.API.Responses.Flights;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AirCharter.API.Controllers
{
    [ApiController]
    [Route("planes")]
    public class PlanesController(AirCharterExtendedContext context) : ControllerBase
    {
        private readonly AirCharterExtendedContext _context = context;

        [HttpGet]
        public async Task<IActionResult> GetPlanes(CancellationToken cancellationToken)
        {
            List<PlaneCatalogResponse> planeCatalogResponses = await _context.Planes
                .AsNoTracking()
                .Select(plane => new PlaneCatalogResponse
                {
                    Id = plane.Id,
                    ModelName = plane.ModelName,
                    PassengerCapacity = plane.PassengerCapacity,
                    MaxDistance = plane.MaxDistance,
                    DistanceKm = 0,
                    FlightTime = TimeSpan.Zero,
                    FlightCost = 0,
                    NumberOfTransfers = 0,
                    ImageBase64 = plane.Image == null ? null : Convert.ToBase64String(plane.Image)
                })
                .ToListAsync(cancellationToken);

            return Ok(planeCatalogResponses);
        }
    }
}
