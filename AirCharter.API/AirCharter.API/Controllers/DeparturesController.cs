using AirCharter.API.Model;
using AirCharter.API.Requests.Departures;
using AirCharter.API.Responses.Airports;
using AirCharter.API.Responses.Departures;
using AirCharter.API.Responses.Flights;
using AirCharter.API.Services;
using AirCharter.API.Services.Documents;
using AirCharter.API.Services.Routing;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AirCharter.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("departures")]
    public class DeparturesController(AirCharterExtendedContext context, RoutePlanningService routePlanningService, AirportGraphCache airportGraphCache, DeparturePdfDataFactory departurePdfDataFactory, TicketPdfService ticketPdfService, EmailService emailService) : ControllerBase
    {
        private static readonly TimeSpan BaseOperationalDuration = TimeSpan.FromMinutes(30);

        private readonly AirCharterExtendedContext _context = context;
        private readonly RoutePlanningService _routePlanningService = routePlanningService;
        private readonly AirportGraphCache _airportGraphCache = airportGraphCache;

        private readonly TicketPdfService _ticketPdfService = ticketPdfService;
        private readonly DeparturePdfDataFactory _departurePdfDataFactory = departurePdfDataFactory;
        private readonly EmailService _emailService = emailService;

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
                .FirstOrDefaultAsync(currentPlane => currentPlane.Id == createDepartureRequest.PlaneId, cancellationToken);

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

            AirportGraph airportGraph = await _airportGraphCache.GetOrCreateAsync(_context, cancellationToken);

            if (!airportGraph.ContainsAirport(createDepartureRequest.TakeOffAirportId))
                return NotFound("Аэропорт вылета не найден.");

            if (!airportGraph.ContainsAirport(createDepartureRequest.LandingAirportId))
                return NotFound("Аэропорт посадки не найден.");

            Plane[] selectedPlanes = new Plane[] { plane };

            PlaneCatalogResponse routeCalculation = _routePlanningService
                .CalculateCatalog(
                    selectedPlanes,
                    airportGraph,
                    createDepartureRequest.TakeOffAirportId,
                    createDepartureRequest.LandingAirportId)
                .First();

            if (!routeCalculation.IsRouteFound)
                return BadRequest("Для выбранного самолёта маршрут не найден.");

            Departure departure = new Departure
            {
                CharterRequesterId = userId,
                PlaneId = createDepartureRequest.PlaneId,
                TakeOffAirportId = createDepartureRequest.TakeOffAirportId,
                LandingAirportId = createDepartureRequest.LandingAirportId,
                RequestedTakeOffDateTime = createDepartureRequest.RequestedTakeOffDateTime
            };

            AddRouteLegs(departure, routeCalculation.RouteLegs);
            ApplyRouteTotals(departure);

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
        public async Task<IActionResult> CalculateCost(FlightCostRequest request, CancellationToken cancellationToken)
        {
            Plane? plane = await _context.Planes
                .Include(plane => plane.Airline)
                .FirstOrDefaultAsync(
                    plane => plane.Id == request.PlaneId,
                    cancellationToken);

            if (plane is null)
                return NotFound("Самолёт не найден.");

            AirportGraph airportGraph = await _airportGraphCache.GetOrCreateAsync(
                _context,
                cancellationToken);

            if (!airportGraph.ContainsAirport(request.TakeOffAirportId))
                return NotFound("Аэропорт вылета не найден.");

            if (!airportGraph.ContainsAirport(request.LandingAirportId))
                return NotFound("Аэропорт посадки не найден.");

            Plane[] selectedPlanes = new Plane[] { plane };

            PlaneCatalogResponse routeCalculation = _routePlanningService
                .CalculateCatalog(
                    selectedPlanes,
                    airportGraph,
                    request.TakeOffAirportId,
                    request.LandingAirportId)
                .First();

            if (!routeCalculation.IsRouteFound)
                return BadRequest("Для выбранного самолёта маршрут не найден.");

            return Ok(routeCalculation);
        }

        [HttpGet("management")]
        [Authorize(Roles = "Owner,Manager,Admin,GeneralDirector,Employee")]
        public async Task<ActionResult<IEnumerable<ManagementDepartureResponse>>> GetManagementDepartures(
            [FromQuery] string section = "orders",
            CancellationToken cancellationToken = default)
        {
            Claim? userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);

            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
            {
                return Unauthorized();
            }

            if (!TryParseManagementSection(section, out ManagementDepartureSection managementSection))
                return BadRequest("Unknown management section.");

            int? userAirlineId = await _context.Users
                .AsNoTracking()
                .Where(user => user.Id == userId)
                .Select(user => user.AirlineId)
                .FirstOrDefaultAsync(cancellationToken);

            if (userAirlineId == null)
            {
                return Forbid();
            }

            List<Departure> departures = await _context.Departures
                .AsNoTracking()
                .Include(departure => departure.Plane)
                    .ThenInclude(plane => plane.Airline)
                .Include(departure => departure.TakeOffAirport)
                .Include(departure => departure.LandingAirport)
                .Include(departure => departure.CharterRequester)
                .Include(departure => departure.People)
                .Include(departure => departure.DepartureStatuses)
                    .ThenInclude(departureStatus => departureStatus.Status)
                .Include(departure => departure.DepartureRouteLegs)
                    .ThenInclude(routeLeg => routeLeg.FromAirport)
                .Include(departure => departure.DepartureRouteLegs)
                    .ThenInclude(routeLeg => routeLeg.ToAirport)
                .Where(departure => departure.Plane.AirlineId == userAirlineId.Value)
                .OrderByDescending(departure => departure.RequestedTakeOffDateTime)
                .ToListAsync(cancellationToken);

            List<ManagementDepartureResponse> responses = departures
                .Select(departure => CreateManagementDepartureResponse(
                    departure,
                    managementSection))
                .Where(response => response is not null)
                .Select(response => response!)
                .ToList();

            return Ok(responses);
        }

        [HttpGet("management/{departureId:int}")]
        [Authorize(Roles = "Owner,Manager,Admin,GeneralDirector,Employee")]
        public async Task<ActionResult<ManagementDepartureResponse>> GetManagementDeparture(
            int departureId,
            CancellationToken cancellationToken)
        {
            int? userAirlineId = await GetCurrentUserAirlineIdAsync(cancellationToken);

            if (userAirlineId is null)
                return Forbid();

            Departure? departure = await GetManagementDepartureQuery()
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    departure => departure.Id == departureId
                        && departure.Plane.AirlineId == userAirlineId.Value,
                    cancellationToken);

            if (departure is null)
                return NotFound();

            DepartureStatus? currentStatus = GetCurrentStatus(departure);

            if (currentStatus is null)
                return NotFound();

            return Ok(CreateManagementDepartureResponse(departure, currentStatus));
        }

        [HttpGet("my/{departureId:int}")]
        public async Task<ActionResult<ManagementDepartureResponse>> GetMyDeparture(
            int departureId,
            CancellationToken cancellationToken)
        {
            int? userId = GetCurrentUserId();

            if (userId is null)
                return Unauthorized();

            Departure? departure = await GetManagementDepartureQuery()
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    departure => departure.Id == departureId &&
                        departure.CharterRequesterId == userId.Value,
                    cancellationToken);

            if (departure is null)
                return NotFound();

            DepartureStatus? currentStatus = GetCurrentStatus(departure);

            if (currentStatus is null)
                return NotFound();

            return Ok(CreateManagementDepartureResponse(departure, currentStatus));
        }

        [HttpPost("my/{departureId:int}/passengers")]
        public async Task<IActionResult> AddMyDeparturePassenger(
            int departureId,
            [FromBody] UpdateDeparturePassengerRequest request,
            CancellationToken cancellationToken)
        {
            Departure? departure = await GetEditableRequesterDepartureAsync(
                departureId,
                cancellationToken);

            if (departure is null)
                return NotFound();

            if (departure.People.Count >= departure.Plane.PassengerCapacity)
                return BadRequest("В самолёте нет свободных мест.");

            Person? person = await _context.Persons
                .FirstOrDefaultAsync(person => person.Id == request.PersonId, cancellationToken);

            if (person is null)
                return NotFound("Пассажир не найден.");

            if (departure.People.Any(existingPerson => existingPerson.Id == person.Id))
                return NoContent();

            departure.People.Add(person);
            await _context.SaveChangesAsync(cancellationToken);

            return NoContent();
        }

        [HttpDelete("my/{departureId:int}/passengers/{personId:int}")]
        public async Task<IActionResult> RemoveMyDeparturePassenger(
            int departureId,
            int personId,
            CancellationToken cancellationToken)
        {
            Departure? departure = await GetEditableRequesterDepartureAsync(
                departureId,
                cancellationToken);

            if (departure is null)
                return NotFound();

            Person? person = departure.People.FirstOrDefault(person => person.Id == personId);

            if (person is null)
                return NoContent();

            departure.People.Remove(person);
            await _context.SaveChangesAsync(cancellationToken);

            return NoContent();
        }

        [HttpPost("management/{departureId:int}/approve")]
        [Authorize(Roles = "Owner,Manager,Admin,GeneralDirector,Employee")]
        public async Task<IActionResult> ApproveManagementDeparture(
            int departureId,
            CancellationToken cancellationToken)
        {
            Departure? departure = await GetEditableManagementDepartureAsync(
                departureId,
                cancellationToken);

            if (departure is null)
                return NotFound();

            DepartureStatus? currentStatus = GetCurrentStatus(departure);

            if (currentStatus?.StatusId != (int)FlightStatusId.AwaitingApproval)
                return BadRequest("Заявку можно одобрить только в статусе ожидания одобрения.");

            AddDepartureStatus(departure, FlightStatusId.Scheduled);
            await _context.SaveChangesAsync(cancellationToken);

            return NoContent();
        }

        [HttpPost("management/{departureId:int}/approve-route")]
        [Authorize(Roles = "Owner,Manager,Admin,GeneralDirector,Employee")]
        public async Task<IActionResult> ApproveManagementDepartureRoute(
            int departureId,
            UpdateDepartureRouteRequest request,
            CancellationToken cancellationToken)
        {
            Departure? departure = await GetEditableManagementDepartureAsync(
                departureId,
                cancellationToken);

            if (departure is null)
                return NotFound();

            DepartureStatus? currentStatus = GetCurrentStatus(departure);

            if (currentStatus?.StatusId != (int)FlightStatusId.AwaitingApproval)
                return BadRequest("Маршрут можно редактировать только до одобрения заявки.");

            ActionResult<ManualRouteCalculation> calculationResult = await TryCalculateManualRouteAsync(
                departure,
                request,
                allowSameAirportLegs: false,
                cancellationToken);

            if (calculationResult.Result is not null)
                return calculationResult.Result;

            ManualRouteCalculation calculation = calculationResult.Value!;

            if (!CreateManagementRoutePreviewResponse(departure.Plane, calculation.RouteLegs).CanFly)
                return BadRequest("Одно из плеч маршрута превышает безопасную дальность самолёта.");

            List<DepartureRouteLeg> existingRouteLegs = departure.DepartureRouteLegs.ToList();
            _context.DepartureRouteLegs.RemoveRange(existingRouteLegs);
            departure.DepartureRouteLegs.Clear();

            AddRouteLegs(departure, calculation.RouteLegs);
            ApplyRouteTotals(departure);

            AddDepartureStatus(departure, FlightStatusId.Scheduled);
            await _context.SaveChangesAsync(cancellationToken);

            return NoContent();
        }

        [HttpPost("management/{departureId:int}/route")]
        [Authorize(Roles = "Owner,Manager,Admin,GeneralDirector,Employee")]
        public async Task<IActionResult> SaveManagementDepartureRoute(
            int departureId,
            UpdateDepartureRouteRequest request,
            CancellationToken cancellationToken)
        {
            Departure? departure = await GetEditableManagementDepartureAsync(
                departureId,
                cancellationToken);

            if (departure is null)
                return NotFound();

            DepartureStatus? currentStatus = GetCurrentStatus(departure);

            if (currentStatus?.StatusId != (int)FlightStatusId.AwaitingApproval)
                return BadRequest("Маршрут можно редактировать только до одобрения заявки.");

            ActionResult<ManualRouteCalculation> calculationResult = await TryCalculateManualRouteAsync(
                departure,
                request,
                allowSameAirportLegs: false,
                cancellationToken);

            if (calculationResult.Result is not null)
                return calculationResult.Result;

            ManualRouteCalculation calculation = calculationResult.Value!;

            if (!CreateManagementRoutePreviewResponse(departure.Plane, calculation.RouteLegs).CanFly)
                return BadRequest("Одно из плеч маршрута превышает безопасную дальность самолёта.");

            List<DepartureRouteLeg> existingRouteLegs = departure.DepartureRouteLegs.ToList();
            _context.DepartureRouteLegs.RemoveRange(existingRouteLegs);
            departure.DepartureRouteLegs.Clear();

            AddRouteLegs(departure, calculation.RouteLegs);
            ApplyRouteTotals(departure);

            await _context.SaveChangesAsync(cancellationToken);
            await SendRouteChangedEmailAsync(departure, calculation.RouteAirports, cancellationToken);

            return NoContent();
        }

        [HttpPost("management/{departureId:int}/route-preview")]
        [Authorize(Roles = "Owner,Manager,Admin,GeneralDirector,Employee")]
        public async Task<ActionResult<ManagementRoutePreviewResponse>> PreviewManagementDepartureRoute(
            int departureId,
            UpdateDepartureRouteRequest request,
            CancellationToken cancellationToken)
        {
            Departure? departure = await GetEditableManagementDepartureAsync(
                departureId,
                cancellationToken);

            if (departure is null)
                return NotFound();

            ActionResult<ManualRouteCalculation> calculationResult = await TryCalculateManualRouteAsync(
                departure,
                request,
                allowSameAirportLegs: true,
                cancellationToken);

            if (calculationResult.Result is not null)
                return calculationResult.Result;

            ManualRouteCalculation calculation = calculationResult.Value!;

            return Ok(CreateManagementRoutePreviewResponse(
                departure.Plane,
                calculation.RouteLegs,
                calculation.RouteAirports));
        }

        [HttpPost("my/{departureId:int}/route-preview")]
        public async Task<ActionResult<ManagementRoutePreviewResponse>> PreviewMyDepartureRoute(
            int departureId,
            UpdateDepartureRouteRequest request,
            CancellationToken cancellationToken)
        {
            Departure? departure = await GetEditableRequesterDepartureAsync(
                departureId,
                cancellationToken);

            if (departure is null)
                return NotFound();

            ActionResult<ManualRouteCalculation> calculationResult = await TryCalculateManualRouteAsync(
                departure,
                request,
                allowSameAirportLegs: true,
                cancellationToken);

            if (calculationResult.Result is not null)
                return calculationResult.Result;

            ManualRouteCalculation calculation = calculationResult.Value!;

            return Ok(CreateManagementRoutePreviewResponse(
                departure.Plane,
                calculation.RouteLegs,
                calculation.RouteAirports));
        }

        [HttpPost("my/{departureId:int}/route")]
        public async Task<IActionResult> SaveMyDepartureRoute(
            int departureId,
            UpdateDepartureRouteRequest request,
            CancellationToken cancellationToken)
        {
            Departure? departure = await GetEditableRequesterDepartureAsync(
                departureId,
                cancellationToken);

            if (departure is null)
                return NotFound();

            ActionResult<ManualRouteCalculation> calculationResult = await TryCalculateManualRouteAsync(
                departure,
                request,
                allowSameAirportLegs: false,
                cancellationToken);

            if (calculationResult.Result is not null)
                return calculationResult.Result;

            ManualRouteCalculation calculation = calculationResult.Value!;

            if (!CreateManagementRoutePreviewResponse(departure.Plane, calculation.RouteLegs).CanFly)
                return BadRequest("Одно из плеч маршрута превышает безопасную дальность самолёта.");

            List<DepartureRouteLeg> existingRouteLegs = departure.DepartureRouteLegs.ToList();
            _context.DepartureRouteLegs.RemoveRange(existingRouteLegs);
            departure.DepartureRouteLegs.Clear();

            AddRouteLegs(departure, calculation.RouteLegs);
            ApplyRouteTotals(departure);

            await _context.SaveChangesAsync(cancellationToken);

            return NoContent();
        }

        [HttpGet("management/{departureId:int}/route-candidates")]
        [Authorize(Roles = "Owner,Manager,Admin,GeneralDirector,Employee")]
        public async Task<ActionResult<IEnumerable<ManagementRouteCandidateResponse>>> GetManagementRouteCandidates(
            int departureId,
            [FromQuery] int fromAirportId,
            [FromQuery] int? toAirportId,
            [FromQuery] int limit = 30,
            CancellationToken cancellationToken = default)
        {
            Departure? departure = await GetEditableManagementDepartureAsync(
                departureId,
                cancellationToken);

            if (departure is null)
                return NotFound();

            return await GetRouteCandidatesAsync(
                departure,
                fromAirportId,
                toAirportId,
                limit,
                cancellationToken);
        }

        [HttpGet("my/{departureId:int}/route-candidates")]
        public async Task<ActionResult<IEnumerable<ManagementRouteCandidateResponse>>> GetMyRouteCandidates(
            int departureId,
            [FromQuery] int fromAirportId,
            [FromQuery] int? toAirportId,
            [FromQuery] int limit = 30,
            CancellationToken cancellationToken = default)
        {
            Departure? departure = await GetEditableRequesterDepartureAsync(
                departureId,
                cancellationToken);

            if (departure is null)
                return NotFound();

            return await GetRouteCandidatesAsync(
                departure,
                fromAirportId,
                toAirportId,
                limit,
                cancellationToken);
        }

        private async Task<ActionResult<IEnumerable<ManagementRouteCandidateResponse>>> GetRouteCandidatesAsync(
            Departure departure,
            int fromAirportId,
            int? toAirportId,
            int limit,
            CancellationToken cancellationToken)
        {
            AirportGraph airportGraph = await _airportGraphCache.GetOrCreateAsync(_context, cancellationToken);

            if (!airportGraph.ContainsAirport(fromAirportId))
                return BadRequest("Аэропорт вылета плеча не найден.");

            int destinationAirportId = toAirportId ?? departure.LandingAirportId;

            if (!airportGraph.ContainsAirport(destinationAirportId))
                return BadRequest("Аэропорт прибытия участка не найден.");

            int maximumLegDistanceKilometers = RoutePlanningService.GetMaximumLegDistanceKilometers(
                departure.Plane.MaxDistance);
            AirportRouteNode fromAirport = airportGraph.GetAirport(fromAirportId);
            AirportRouteNode destinationAirport = airportGraph.GetAirport(destinationAirportId);
            int? bestSystemAirportId = _routePlanningService.FindBestNextAirportId(
                airportGraph,
                fromAirportId,
                destinationAirportId,
                maximumLegDistanceKilometers);

            Dictionary<int, int> distanceFromCurrentByAirportId = airportGraph.SpatialIndex
                .FindAirportsWithinDistance(fromAirport, maximumLegDistanceKilometers)
                .Where(airportNeighbor => airportNeighbor.Airport.Id != fromAirportId)
                .ToDictionary(
                    airportNeighbor => airportNeighbor.Airport.Id,
                    airportNeighbor => airportNeighbor.DistanceKilometers);

            if (distanceFromCurrentByAirportId.Count == 0)
                return Ok(Array.Empty<ManagementRouteCandidateResponse>());

            int[] candidateAirportIds = distanceFromCurrentByAirportId.Keys.ToArray();
            List<Airport> airports = await _context.Airports
                .AsNoTracking()
                .Include(airport => airport.AirportRoutePriority)
                .Where(airport => candidateAirportIds.Contains(airport.Id))
                .ToListAsync(cancellationToken);

            int candidatesLimit = Math.Clamp(limit, 1, 50);

            List<ManagementRouteCandidateResponse> candidates = airports
                .Select(airport =>
                {
                    AirportRouteNode candidateAirport = airportGraph.GetAirport(airport.Id);
                    int distanceFromCurrentKm = distanceFromCurrentByAirportId[airport.Id];
                    int distanceToDestinationKm = GeoDistanceCalculator.CalculateDistanceKilometers(
                        candidateAirport,
                        destinationAirport);

                    return CreateManagementRouteCandidateResponse(
                        airport,
                        distanceFromCurrentKm,
                        distanceToDestinationKm,
                        airport.Id == bestSystemAirportId);
                })
                .OrderBy(candidate => candidate.IsBestSystemChoice ? 0 : 1)
                .ThenByDescending(candidate => candidate.PriorityScore)
                .ThenBy(candidate => candidate.DistanceToDestinationKm)
                .ThenBy(candidate => candidate.DistanceFromCurrentKm)
                .Take(candidatesLimit)
                .ToList();

            return Ok(candidates);
        }

        [HttpPost("management/{departureId:int}/reject")]
        [Authorize(Roles = "Owner,Manager,Admin,GeneralDirector,Employee")]
        public async Task<IActionResult> RejectManagementDeparture(
            int departureId,
            CancellationToken cancellationToken)
        {
            Departure? departure = await GetEditableManagementDepartureAsync(
                departureId,
                cancellationToken);

            if (departure is null)
                return NotFound();

            DepartureStatus? currentStatus = GetCurrentStatus(departure);

            if (currentStatus?.StatusId != (int)FlightStatusId.AwaitingApproval)
                return BadRequest("Заявку можно отклонить только в статусе ожидания одобрения.");

            AddDepartureStatus(departure, FlightStatusId.Denied);
            await _context.SaveChangesAsync(cancellationToken);

            return NoContent();
        }

        private ManagementDepartureResponse? CreateManagementDepartureResponse(
            Departure departure,
            ManagementDepartureSection section)
        {
            DepartureStatus? currentStatus = GetCurrentStatus(departure);

            if (currentStatus is null || !IsDepartureInManagementSection(currentStatus.StatusId, section))
                return null;

            return CreateManagementDepartureResponse(departure, currentStatus);
        }

        private ManagementDepartureResponse? CreateManagementDepartureResponse(Departure departure)
        {
            DepartureStatus? currentStatus = GetCurrentStatus(departure);

            if (currentStatus is null || currentStatus.StatusId == (int)FlightStatusId.InCreation)
                return null;

            return CreateManagementDepartureResponse(departure, currentStatus);
        }

        private ManagementDepartureResponse CreateManagementDepartureResponse(
            Departure departure,
            DepartureStatus currentStatus)
        {
            IReadOnlyCollection<ManagementDepartureStatusResponse> statusHistory = departure.DepartureStatuses
                .OrderBy(departureStatus => departureStatus.StatusSettingDateTime)
                .ThenBy(departureStatus => departureStatus.Id)
                .Select(departureStatus => new ManagementDepartureStatusResponse
                {
                    Id = departureStatus.StatusId,
                    Name = departureStatus.Status.Status1,
                    SetAt = departureStatus.StatusSettingDateTime
                })
                .ToArray();

            RouteTotals routeTotals = CreateRouteTotals(departure);

            return new ManagementDepartureResponse
            {
                Id = departure.Id,
                PlaneModelName = departure.Plane.ModelName,
                PlanePassengerCapacity = departure.Plane.PassengerCapacity,

                TakeOffAirportId = departure.TakeOffAirportId,
                TakeOffAirportName = departure.TakeOffAirport.Name,
                TakeOffAirportCity = departure.TakeOffAirport.City,
                TakeOffAirportIata = departure.TakeOffAirport.Iata,
                TakeOffAirportIcao = departure.TakeOffAirport.Icao,

                LandingAirportId = departure.LandingAirportId,
                LandingAirportName = departure.LandingAirport.Name,
                LandingAirportCity = departure.LandingAirport.City,
                LandingAirportIata = departure.LandingAirport.Iata,
                LandingAirportIcao = departure.LandingAirport.Icao,

                RequestedTakeOffDateTime = departure.RequestedTakeOffDateTime,
                ArrivalDateTime = departure.RequestedTakeOffDateTime.Add(routeTotals.FlightTime),
                CreatedAt = statusHistory
                    .FirstOrDefault(status => status.Id == (int)FlightStatusId.InCreation)
                    ?.SetAt,
                Price = routeTotals.Price,
                Distance = routeTotals.Distance,
                FlightTime = routeTotals.FlightTime,
                Transfers = routeTotals.Transfers,

                CurrentStatusId = currentStatus.StatusId,
                StatusName = currentStatus.Status.Status1,
                CurrentStatusSetAt = currentStatus.StatusSettingDateTime,
                CharterRequesterEmail = departure.CharterRequester.Email,
                PassengerCount = departure.People.Count,
                CanEditRoute =
                    currentStatus.StatusId == (int)FlightStatusId.InCreation ||
                    currentStatus.StatusId == (int)FlightStatusId.AwaitingApproval,
                CanApprove = currentStatus.StatusId == (int)FlightStatusId.AwaitingApproval,
                CanChangeStatus = IsActiveFlightStatus(currentStatus.StatusId),

                Passengers = departure.People
                    .OrderBy(person => person.LastName)
                    .ThenBy(person => person.FirstName)
                    .Select(person => new ManagementPassengerResponse
                    {
                        Id = person.Id,
                        FullName = BuildPersonFullName(person),
                        Email = person.Email
                    })
                    .ToArray(),
                StatusHistory = statusHistory,
                RouteAirports = CreateRouteAirportResponses(departure),
                RouteLegs = CreateRouteLegResponses(departure)
            };
        }

        private static IReadOnlyCollection<AirportSearchResponse> CreateRouteAirportResponses(Departure departure)
        {
            List<DepartureRouteLeg> orderedRouteLegs = departure.DepartureRouteLegs
                .OrderBy(routeLeg => routeLeg.SequenceNumber)
                .ToList();

            if (orderedRouteLegs.Count == 0)
                return Array.Empty<AirportSearchResponse>();

            List<AirportSearchResponse> routeAirports = new List<AirportSearchResponse>
            {
                CreateAirportResponse(orderedRouteLegs[0].FromAirport)
            };

            foreach (DepartureRouteLeg routeLeg in orderedRouteLegs)
                routeAirports.Add(CreateAirportResponse(routeLeg.ToAirport));

            return routeAirports;
        }

        private static IReadOnlyCollection<RouteLegResponse> CreateRouteLegResponses(Departure departure)
        {
            return departure.DepartureRouteLegs
                .OrderBy(routeLeg => routeLeg.SequenceNumber)
                .Select(routeLeg => new RouteLegResponse
                {
                    FromAirportId = routeLeg.FromAirportId,
                    ToAirportId = routeLeg.ToAirportId,
                    DistanceKm = routeLeg.Distance,
                    FlightTime = routeLeg.FlightTime,
                    FlightCost = routeLeg.FlightCost,
                    GroundTimeAfterArrival = routeLeg.GroundTimeAfterArrival
                })
                .ToArray();
        }

        private IQueryable<Departure> GetManagementDepartureQuery()
        {
            return _context.Departures
                .Include(departure => departure.Plane)
                    .ThenInclude(plane => plane.Airline)
                .Include(departure => departure.TakeOffAirport)
                .Include(departure => departure.LandingAirport)
                .Include(departure => departure.CharterRequester)
                .Include(departure => departure.People)
                .Include(departure => departure.DepartureStatuses)
                    .ThenInclude(departureStatus => departureStatus.Status)
                .Include(departure => departure.DepartureRouteLegs)
                    .ThenInclude(routeLeg => routeLeg.FromAirport)
                .Include(departure => departure.DepartureRouteLegs)
                    .ThenInclude(routeLeg => routeLeg.ToAirport);
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

        private async Task<Departure?> GetEditableManagementDepartureAsync(
            int departureId,
            CancellationToken cancellationToken)
        {
            int? userAirlineId = await GetCurrentUserAirlineIdAsync(cancellationToken);

            if (userAirlineId is null)
                return null;

            return await GetManagementDepartureQuery()
                .FirstOrDefaultAsync(
                    departure => departure.Id == departureId
                        && departure.Plane.AirlineId == userAirlineId.Value,
                    cancellationToken);
        }

        private async Task<Departure?> GetEditableRequesterDepartureAsync(
            int departureId,
            CancellationToken cancellationToken)
        {
            int? userId = GetCurrentUserId();

            if (userId is null)
                return null;

            Departure? departure = await GetManagementDepartureQuery()
                .FirstOrDefaultAsync(
                    departure => departure.Id == departureId &&
                        departure.CharterRequesterId == userId.Value,
                    cancellationToken);

            if (departure is null)
                return null;

            DepartureStatus? currentStatus = GetCurrentStatus(departure);

            if (currentStatus is null ||
                (currentStatus.StatusId != (int)FlightStatusId.InCreation &&
                 currentStatus.StatusId != (int)FlightStatusId.AwaitingApproval))
            {
                return null;
            }

            return departure;
        }

        private async Task<ActionResult<ManualRouteCalculation>> TryCalculateManualRouteAsync(
            Departure departure,
            UpdateDepartureRouteRequest request,
            bool allowSameAirportLegs,
            CancellationToken cancellationToken)
        {
            if (request.AirportIds.Count < 2)
                return BadRequest("В маршруте должно быть минимум два аэропорта.");

            int[] airportIds = request.AirportIds.ToArray();

            if (airportIds[0] != departure.TakeOffAirportId)
                return BadRequest("Первый аэропорт маршрута должен совпадать с аэропортом вылета.");

            if (airportIds[^1] != departure.LandingAirportId)
                return BadRequest("Последний аэропорт маршрута должен совпадать с аэропортом прилёта.");

            for (int airportIndex = 1; airportIndex < airportIds.Length; airportIndex++)
            {
                if (!allowSameAirportLegs && airportIds[airportIndex - 1] == airportIds[airportIndex])
                    return BadRequest("Соседние плечи не могут использовать один и тот же аэропорт.");
            }

            TimeSpan?[] groundTimesAfterArrival = request.GroundTimesAfterArrival.ToArray();
            int legsCount = airportIds.Length - 1;

            if (groundTimesAfterArrival.Length > legsCount)
                return BadRequest("Количество стоянок не должно превышать количество плеч маршрута.");

            foreach (TimeSpan? groundTimeAfterArrival in groundTimesAfterArrival)
            {
                if (groundTimeAfterArrival is { } value
                    && (value < TimeSpan.Zero || value > TimeSpan.FromHours(24)))
                {
                    return BadRequest("Время стоянки должно быть от 0 до 24 часов.");
                }
            }

            List<Airport> airports = await _context.Airports
                .Where(airport => airportIds.Contains(airport.Id))
                .ToListAsync(cancellationToken);

            if (airports.Count != airportIds.Distinct().Count())
                return BadRequest("Один или несколько аэропортов маршрута не найдены.");

            Dictionary<int, Airport> airportById = airports.ToDictionary(airport => airport.Id);
            List<Airport> orderedAirports = airportIds
                .Select(airportId => airportById[airportId])
                .ToList();

            IReadOnlyCollection<RouteLegResponse> routeLegs =
                _routePlanningService.CalculateRouteLegs(
                    departure.Plane,
                    orderedAirports,
                    groundTimesAfterArrival);

            return new ManualRouteCalculation
            {
                RouteAirports = orderedAirports,
                RouteLegs = routeLegs
            };
        }

        private static ManagementRoutePreviewResponse CreateManagementRoutePreviewResponse(
            Plane plane,
            IReadOnlyCollection<RouteLegResponse> routeLegs,
            IReadOnlyCollection<Airport>? routeAirports = null)
        {
            int maximumLegDistanceKm = RoutePlanningService.GetMaximumLegDistanceKilometers(
                plane.MaxDistance);
            bool canFly = routeLegs.All(routeLeg =>
                routeLeg.FromAirportId != routeLeg.ToAirportId &&
                routeLeg.DistanceKm <= maximumLegDistanceKm);

            TimeSpan flightTime = BaseOperationalDuration;

            foreach (RouteLegResponse routeLeg in routeLegs)
            {
                flightTime += routeLeg.FlightTime;

                if (routeLeg.GroundTimeAfterArrival is not null)
                    flightTime += routeLeg.GroundTimeAfterArrival.Value;
            }

            return new ManagementRoutePreviewResponse
            {
                Distance = routeLegs.Sum(routeLeg => routeLeg.DistanceKm),
                FlightTime = flightTime,
                Price = routeLegs.Sum(routeLeg => routeLeg.FlightCost),
                Transfers = Math.Max(0, routeLegs.Count - 1),
                CanFly = canFly,
                RouteAirports = routeAirports is null
                    ? Array.Empty<AirportSearchResponse>()
                    : routeAirports.Select(CreateAirportResponse).ToArray(),
                RouteLegs = routeLegs
                    .Select(routeLeg => new ManagementRoutePreviewLegResponse
                    {
                        FromAirportId = routeLeg.FromAirportId,
                        ToAirportId = routeLeg.ToAirportId,
                        DistanceKm = routeLeg.DistanceKm,
                        FlightTime = routeLeg.FlightTime,
                        FlightCost = routeLeg.FlightCost,
                        GroundTimeAfterArrival = routeLeg.GroundTimeAfterArrival,
                        CanFly = routeLeg.FromAirportId != routeLeg.ToAirportId &&
                            routeLeg.DistanceKm <= maximumLegDistanceKm,
                        MaximumLegDistanceKm = maximumLegDistanceKm
                    })
                    .ToArray()
            };
        }

        private static void AddDepartureStatus(Departure departure, FlightStatusId statusId)
        {
            departure.DepartureStatuses.Add(new DepartureStatus
            {
                StatusId = (int)statusId,
                StatusSettingDateTime = DateTime.UtcNow
            });
        }

        private static void AddRouteLegs(
            Departure departure,
            IReadOnlyCollection<RouteLegResponse> routeLegs)
        {
            int routeLegSequenceNumber = 1;

            foreach (RouteLegResponse routeLeg in routeLegs)
            {
                departure.DepartureRouteLegs.Add(new DepartureRouteLeg
                {
                    SequenceNumber = routeLegSequenceNumber,
                    FromAirportId = routeLeg.FromAirportId,
                    ToAirportId = routeLeg.ToAirportId,
                    Distance = routeLeg.DistanceKm,
                    FlightTime = routeLeg.FlightTime,
                    FlightCost = routeLeg.FlightCost,
                    GroundTimeAfterArrival = routeLeg.GroundTimeAfterArrival
                });

                routeLegSequenceNumber++;
            }
        }

        private static void ApplyRouteTotals(Departure departure)
        {
            RouteTotals routeTotals = CreateRouteTotals(departure);

            departure.Distance = routeTotals.Distance;
            departure.FlightTime = routeTotals.FlightTime;
            departure.Price = routeTotals.Price;
            departure.Transfers = routeTotals.Transfers;
        }

        private static RouteTotals CreateRouteTotals(Departure departure)
        {
            DepartureRouteLeg[] routeLegs = departure.DepartureRouteLegs
                .OrderBy(routeLeg => routeLeg.SequenceNumber)
                .ToArray();

            if (routeLegs.Length == 0)
            {
                return new RouteTotals
                {
                    Distance = departure.Distance,
                    FlightTime = departure.FlightTime,
                    Price = departure.Price,
                    Transfers = departure.Transfers
                };
            }

            TimeSpan flightTime = BaseOperationalDuration;

            foreach (DepartureRouteLeg routeLeg in routeLegs)
            {
                flightTime += routeLeg.FlightTime;

                if (routeLeg.GroundTimeAfterArrival is not null)
                    flightTime += routeLeg.GroundTimeAfterArrival.Value;
            }

            return new RouteTotals
            {
                Distance = routeLegs.Sum(routeLeg => routeLeg.Distance),
                FlightTime = flightTime,
                Price = routeLegs.Sum(routeLeg => routeLeg.FlightCost),
                Transfers = Math.Max(0, routeLegs.Length - 1)
            };
        }

        private static AirportSearchResponse CreateAirportResponse(Airport airport)
        {
            return new AirportSearchResponse
            {
                Id = airport.Id,
                Name = airport.Name,
                City = airport.City,
                Country = airport.Country,
                Iata = airport.Iata,
                Icao = airport.Icao,
                Latitude = airport.Latitude,
                Longitude = airport.Longitude
            };
        }

        private static ManagementRouteCandidateResponse CreateManagementRouteCandidateResponse(
            Airport airport,
            int distanceFromCurrentKm,
            int distanceToDestinationKm,
            bool isBestSystemChoice)
        {
            AirportRoutePriority? priority = airport.AirportRoutePriority;

            return new ManagementRouteCandidateResponse
            {
                Id = airport.Id,
                Name = airport.Name,
                City = airport.City,
                Country = airport.Country,
                Iata = airport.Iata,
                Icao = airport.Icao,
                Latitude = airport.Latitude,
                Longitude = airport.Longitude,
                DistanceFromCurrentKm = distanceFromCurrentKm,
                DistanceToDestinationKm = distanceToDestinationKm,
                PriorityScore = priority?.PriorityScore ?? 0,
                IsCapital = priority?.IsCapital ?? false,
                IsLargeCity = priority?.IsLargeCity ?? false,
                IsBestSystemChoice = isBestSystemChoice
            };
        }

        private async Task SendRouteChangedEmailAsync(
            Departure departure,
            IReadOnlyCollection<Airport> routeAirports,
            CancellationToken cancellationToken)
        {
            string routeText = string.Join(" → ", routeAirports.Select(BuildAirportLabel));

            await _emailService.SendHtmlMessageAsync(
                departure.CharterRequester.Email,
                "Маршрут заявки изменён",
                $"""
                <h3>Маршрут вашей заявки #{departure.Id} был изменён</h3>
                <p>Новый маршрут: <b>{routeText}</b></p>
                <p>Итоговая стоимость: <b>{departure.Price:N0} ₽</b></p>
                <p>Расстояние: <b>{departure.Distance:N0} км</b></p>
                """,
                cancellationToken);
        }

        private static string BuildAirportLabel(Airport airport)
        {
            string? code = airport.Iata ?? airport.Icao;

            return string.IsNullOrWhiteSpace(code)
                ? airport.Name
                : $"{airport.City ?? airport.Name} ({code})";
        }

        private static DepartureStatus? GetCurrentStatus(Departure departure)
        {
            return departure.DepartureStatuses
                .OrderByDescending(departureStatus => departureStatus.StatusSettingDateTime)
                .ThenByDescending(departureStatus => departureStatus.Id)
                .FirstOrDefault();
        }

        private static bool TryParseManagementSection(
            string section,
            out ManagementDepartureSection managementSection)
        {
            switch (section.Trim().ToLowerInvariant())
            {
                case "":
                case "orders":
                    managementSection = ManagementDepartureSection.Orders;
                    return true;

                case "flights":
                    managementSection = ManagementDepartureSection.Flights;
                    return true;

                case "completed":
                    managementSection = ManagementDepartureSection.Completed;
                    return true;

                default:
                    managementSection = ManagementDepartureSection.Orders;
                    return false;
            }
        }

        private static bool IsDepartureInManagementSection(
            int currentStatusId,
            ManagementDepartureSection section)
        {
            return section switch
            {
                ManagementDepartureSection.Orders =>
                    currentStatusId == (int)FlightStatusId.AwaitingApproval,

                ManagementDepartureSection.Flights =>
                    IsActiveFlightStatus(currentStatusId),

                ManagementDepartureSection.Completed =>
                    currentStatusId is
                        (int)FlightStatusId.Landed or
                        (int)FlightStatusId.Cancelled or
                        (int)FlightStatusId.Denied,

                _ => false
            };
        }

        private static bool IsActiveFlightStatus(int currentStatusId)
        {
            return currentStatusId is >= (int)FlightStatusId.Scheduled and <= (int)FlightStatusId.EnRoute
                or (int)FlightStatusId.Delayed
                or (int)FlightStatusId.Redirected;
        }

        private static string BuildPersonFullName(Person person)
        {
            return string.Join(
                " ",
                new[]
                {
                    person.LastName,
                    person.FirstName,
                    person.Patronymic
                }.Where(namePart => !string.IsNullOrWhiteSpace(namePart)));
        }

        [HttpGet("{departureId:int}/ticket")]
        public async Task<IActionResult> DownloadTicket(int departureId, CancellationToken cancellationToken)
        {
            Claim? userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);

            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
                return Unauthorized();

            Departure? departure = await _context.Departures
                .Include(departure => departure.Plane)
                .Include(departure => departure.TakeOffAirport)
                .Include(departure => departure.LandingAirport)
                .Include(departure => departure.People)
                .FirstOrDefaultAsync(
                    departure => departure.Id == departureId && departure.CharterRequesterId == userId,
                    cancellationToken);

            if (departure == null)
                return NotFound();

            DeparturePdfData departurePdfData = _departurePdfDataFactory.Create(departure);
            byte[] pdfBytes = _ticketPdfService.Generate(departurePdfData);

            return File(pdfBytes, "application/pdf", $"ticket-{departureId}.pdf");
        }

        private enum ManagementDepartureSection
        {
            Orders,
            Flights,
            Completed
        }

        private enum FlightStatusId
        {
            InCreation = 1,
            AwaitingApproval = 2,
            Scheduled = 3,
            Planned = 4,
            RegistrationOpen = 5,
            RegistrationClosing = 6,
            RegistrationClosed = 7,
            AwaitingBoarding = 8,
            Boarding = 9,
            GateOpen = 10,
            GateClosed = 11,
            BoardingCompleted = 12,
            EnRoute = 13,
            Landed = 14,
            Delayed = 15,
            Redirected = 16,
            Cancelled = 17,
            Denied = 18
        }

        private sealed class RouteTotals
        {
            public int Distance { get; init; }

            public TimeSpan FlightTime { get; init; }

            public decimal Price { get; init; }

            public int Transfers { get; init; }
        }

        private sealed class ManualRouteCalculation
        {
            public IReadOnlyCollection<Airport> RouteAirports { get; init; } =
                Array.Empty<Airport>();

            public IReadOnlyCollection<RouteLegResponse> RouteLegs { get; init; } =
                Array.Empty<RouteLegResponse>();
        }
    }
}
