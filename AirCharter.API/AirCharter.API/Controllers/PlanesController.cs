using AirCharter.API.Model;
using AirCharter.API.Requests.Planes;
using AirCharter.API.Responses.Flights;
using AirCharter.API.Responses.Planes;
using AirCharter.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AirCharter.API.Controllers
{
    [ApiController]
    [Route("planes")]
    public class PlanesController(AirCharterExtendedContext context) : ControllerBase
    {
        private const string AirlineEmployeeRoles = "Owner,Manager,Admin,GeneralDirector,Employee";
        private const int MinimumMaxDistance = 1000;
        private const int MaximumMaxDistance = 20000;
        private const int MinimumPassengerCapacity = 1;
        private const int MaximumPassengerCapacity = 400;
        private const int MinimumCruisingSpeed = 200;
        private const int MaximumCruisingSpeed = 2500;
        private const decimal MinimumFlightHourCost = 10000;
        private const decimal MaximumFlightHourCost = 50000000;

        private readonly AirCharterExtendedContext _context = context;

        [HttpGet]
        public async Task<IActionResult> GetPlanes(CancellationToken cancellationToken)
        {
            List<PlaneCatalogResponse> planeCatalogResponses = await _context.Planes
                .Include(plane => plane.Airline)
                .Where(AirlineProfileCompleteness.PlaneHasCatalogVisibleAirline)
                .AsNoTracking()
                .Select(plane => new PlaneCatalogResponse
                {
                    Id = plane.Id,
                    ModelName = plane.ModelName,
                    PassengerCapacity = plane.PassengerCapacity,
                    MaxDistance = plane.MaxDistance,
                    CruisingSpeed = plane.CruisingSpeed,
                    DepartureCount = plane.Departures.Count,
                    FlightHourCost = plane.FlightHourCost,
                    DistanceKm = 0,
                    FlightTime = TimeSpan.Zero,
                    FlightCost = 0,
                    NumberOfTransfers = 0,
                    ImageBase64 = plane.Image == null ? null : Convert.ToBase64String(plane.Image),
                    AirlineName = plane.Airline.AirlineName,
                    AirlineImageBase64 = plane.Airline.Image == null
                        ? null
                        : Convert.ToBase64String(plane.Airline.Image)
                })
                .ToListAsync(cancellationToken);

            return Ok(planeCatalogResponses);
        }

        [HttpGet("my")]
        [Authorize(Roles = AirlineEmployeeRoles)]
        public async Task<ActionResult<IEnumerable<ManagementPlaneResponse>>> GetMyPlanes(CancellationToken cancellationToken)
        {
            int? airlineId = await GetCurrentUserAirlineIdAsync(cancellationToken);

            if (airlineId is null)
                return Forbid();

            ManagementPlaneResponse[] planes = await _context.Planes
                .AsNoTracking()
                .Where(plane => plane.AirlineId == airlineId.Value)
                .OrderBy(plane => plane.ModelName)
                .Select(plane => new ManagementPlaneResponse
                {
                    Id = plane.Id,
                    ModelName = plane.ModelName,
                    MaxDistance = plane.MaxDistance,
                    PassengerCapacity = plane.PassengerCapacity,
                    CruisingSpeed = plane.CruisingSpeed,
                    FlightHourCost = plane.FlightHourCost,
                    ImageBase64 = plane.Image == null ? null : Convert.ToBase64String(plane.Image)
                })
                .ToArrayAsync(cancellationToken);

            return Ok(planes);
        }

        [HttpGet("my/{planeId:int}")]
        [Authorize(Roles = AirlineEmployeeRoles)]
        public async Task<ActionResult<ManagementPlaneResponse>> GetMyPlane(
            int planeId,
            CancellationToken cancellationToken)
        {
            int? airlineId = await GetCurrentUserAirlineIdAsync(cancellationToken);

            if (airlineId is null)
                return Forbid();

            Plane? plane = await _context.Planes
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    plane => plane.Id == planeId && plane.AirlineId == airlineId.Value,
                    cancellationToken);

            if (plane is null)
                return NotFound();

            return Ok(CreateManagementResponse(plane));
        }

        [HttpPost("my")]
        [Authorize(Roles = AirlineEmployeeRoles)]
        public async Task<ActionResult<ManagementPlaneResponse>> CreateMyPlane(
            SavePlaneRequest request,
            CancellationToken cancellationToken)
        {
            int? airlineId = await GetCurrentUserAirlineIdAsync(cancellationToken);

            if (airlineId is null)
                return Forbid();

            string? validationError = ValidatePlaneRequest(request);

            if (validationError is not null)
                return BadRequest(validationError);

            Plane plane = new()
            {
                AirlineId = airlineId.Value
            };

            string? imageError = ApplyPlaneRequest(plane, request);

            if (imageError is not null)
                return BadRequest(imageError);

            _context.Planes.Add(plane);
            await _context.SaveChangesAsync(cancellationToken);

            return CreatedAtAction(
                nameof(GetMyPlane),
                new { planeId = plane.Id },
                CreateManagementResponse(plane));
        }

        [HttpPut("my/{planeId:int}")]
        [Authorize(Roles = AirlineEmployeeRoles)]
        public async Task<ActionResult<ManagementPlaneResponse>> UpdateMyPlane(
            int planeId,
            SavePlaneRequest request,
            CancellationToken cancellationToken)
        {
            int? airlineId = await GetCurrentUserAirlineIdAsync(cancellationToken);

            if (airlineId is null)
                return Forbid();

            string? validationError = ValidatePlaneRequest(request);

            if (validationError is not null)
                return BadRequest(validationError);

            Plane? plane = await _context.Planes
                .FirstOrDefaultAsync(
                    plane => plane.Id == planeId && plane.AirlineId == airlineId.Value,
                    cancellationToken);

            if (plane is null)
                return NotFound();

            string? imageError = ApplyPlaneRequest(plane, request);

            if (imageError is not null)
                return BadRequest(imageError);

            await _context.SaveChangesAsync(cancellationToken);

            return Ok(CreateManagementResponse(plane));
        }

        private async Task<int?> GetCurrentUserAirlineIdAsync(CancellationToken cancellationToken)
        {
            int? userId = GetCurrentUserId();

            if (userId is null)
                return null;

            return await _context.Users
                .AsNoTracking()
                .Where(user => user.Id == userId.Value)
                .Select(user => user.AirlineId)
                .FirstOrDefaultAsync(cancellationToken);
        }

        private int? GetCurrentUserId()
        {
            Claim? userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);

            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
                return null;

            return userId;
        }

        private static string? ApplyPlaneRequest(Plane plane, SavePlaneRequest request)
        {
            plane.ModelName = request.ModelName?.Trim() ?? string.Empty;
            plane.MaxDistance = request.MaxDistance;
            plane.PassengerCapacity = request.PassengerCapacity;
            plane.CruisingSpeed = request.CruisingSpeed;
            plane.FlightHourCost = request.FlightHourCost;

            if (string.IsNullOrWhiteSpace(request.ImageBase64))
            {
                plane.Image = null;
                return null;
            }

            string imageBase64 = request.ImageBase64.Trim();
            int commaIndex = imageBase64.IndexOf(',');

            if (commaIndex >= 0)
                imageBase64 = imageBase64[(commaIndex + 1)..];

            try
            {
                byte[] imageBytes = Convert.FromBase64String(imageBase64);

                if (!ImageAspectRatioValidator.HasAspectRatio(imageBytes, 16, 9))
                    return "Изображение самолёта должно быть в формате 16:9.";

                plane.Image = imageBytes;
            }
            catch (FormatException)
            {
                return "Изображение должно быть передано в формате base64.";
            }

            return null;
        }

        private static string? ValidatePlaneRequest(SavePlaneRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.ModelName))
                return "Укажите модель самолета.";

            if (request.ModelName.Trim().Length > 45)
                return "Модель самолета должна быть не длиннее 45 символов.";

            if (request.MaxDistance <= 0)
                return "Максимальная дальность должна быть больше 0.";

            if (request.MaxDistance is < MinimumMaxDistance or > MaximumMaxDistance)
                return $"Дальность должна быть от {MinimumMaxDistance} до {MaximumMaxDistance} км.";

            if (request.PassengerCapacity <= 0)
                return "Пассажировместимость должна быть больше 0.";

            if (request.PassengerCapacity is < MinimumPassengerCapacity or > MaximumPassengerCapacity)
                return $"Пассажировместимость должна быть от {MinimumPassengerCapacity} до {MaximumPassengerCapacity}.";

            if (request.CruisingSpeed <= 0)
                return "Крейсерская скорость должна быть больше 0.";

            if (request.CruisingSpeed is < MinimumCruisingSpeed or > MaximumCruisingSpeed)
                return $"Крейсерская скорость должна быть от {MinimumCruisingSpeed} до {MaximumCruisingSpeed} км/ч.";

            if (request.FlightHourCost <= 0)
                return "Стоимость часа полета должна быть больше 0.";

            if (request.FlightHourCost is < MinimumFlightHourCost or > MaximumFlightHourCost)
                return $"Стоимость часа должна быть от {MinimumFlightHourCost:N0} до {MaximumFlightHourCost:N0} ₽.";

            return null;
        }

        private static ManagementPlaneResponse CreateManagementResponse(Plane plane)
        {
            return new ManagementPlaneResponse
            {
                Id = plane.Id,
                ModelName = plane.ModelName,
                MaxDistance = plane.MaxDistance,
                PassengerCapacity = plane.PassengerCapacity,
                CruisingSpeed = plane.CruisingSpeed,
                FlightHourCost = plane.FlightHourCost,
                ImageBase64 = plane.Image == null ? null : Convert.ToBase64String(plane.Image)
            };
        }
    }
}
