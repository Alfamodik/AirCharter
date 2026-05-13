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
    public class DeparturesController(
        AirCharterExtendedContext context,
        RoutePlanningService routePlanningService,
        AirportGraphCache airportGraphCache,
        DeparturePdfDataFactory departurePdfDataFactory,
        TicketPdfService ticketPdfService,
        ContractPdfDataFactory contractPdfDataFactory,
        ContractPdfService contractPdfService,
        EmailService emailService) : ControllerBase
    {
        private const string ManagementViewerRoles = "Owner,Manager,Admin,GeneralDirector,Employee";
        private const string ManagementEditorRoles = ManagementViewerRoles;
        private static readonly TimeSpan BaseOperationalDuration = TimeSpan.FromMinutes(30);

        private readonly AirCharterExtendedContext _context = context;
        private readonly RoutePlanningService _routePlanningService = routePlanningService;
        private readonly AirportGraphCache _airportGraphCache = airportGraphCache;

        private readonly TicketPdfService _ticketPdfService = ticketPdfService;
        private readonly DeparturePdfDataFactory _departurePdfDataFactory = departurePdfDataFactory;
        private readonly ContractPdfDataFactory _contractPdfDataFactory = contractPdfDataFactory;
        private readonly ContractPdfService _contractPdfService = contractPdfService;
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

            if (IsRequestedTakeOffDateTimeTooEarly(createDepartureRequest.RequestedTakeOffDateTime))
                return BadRequest("Дата и время вылета должны быть не раньше завтрашнего дня.");

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
        [Authorize(Roles = ManagementViewerRoles)]
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

            var departureRows = await _context.Departures
                .AsNoTracking()
                .Where(departure => departure.Plane.AirlineId == userAirlineId.Value)
                .OrderByDescending(departure => departure.RequestedTakeOffDateTime)
                .Select(departure => new
                {
                    departure.Id,
                    PlaneModelName = departure.Plane.ModelName,
                    PlanePassengerCapacity = departure.Plane.PassengerCapacity,
                    AirlineName = departure.Plane.Airline.AirlineName,
                    AirlineEmail = departure.Plane.Airline.Email,
                    AirlinePhoneNumber = departure.Plane.Airline.PhoneNumber,

                    departure.TakeOffAirportId,
                    TakeOffAirportName = departure.TakeOffAirport.Name,
                    TakeOffAirportCity = departure.TakeOffAirport.City,
                    TakeOffAirportIata = departure.TakeOffAirport.Iata,
                    TakeOffAirportIcao = departure.TakeOffAirport.Icao,

                    departure.LandingAirportId,
                    LandingAirportName = departure.LandingAirport.Name,
                    LandingAirportCity = departure.LandingAirport.City,
                    LandingAirportIata = departure.LandingAirport.Iata,
                    LandingAirportIcao = departure.LandingAirport.Icao,

                    departure.RequestedTakeOffDateTime,
                    departure.Price,
                    departure.Distance,
                    departure.FlightTime,
                    departure.Transfers,

                    CurrentStatus = departure.DepartureStatuses
                        .OrderByDescending(departureStatus => departureStatus.StatusSettingDateTime)
                        .ThenByDescending(departureStatus => departureStatus.Id)
                        .Select(departureStatus => new
                        {
                            departureStatus.StatusId,
                            StatusName = departureStatus.Status.Status1,
                            departureStatus.StatusSettingDateTime
                        })
                        .FirstOrDefault(),
                    CreatedAt = departure.DepartureStatuses
                        .Where(departureStatus => departureStatus.StatusId == (int)FlightStatusId.InCreation)
                        .OrderBy(departureStatus => departureStatus.StatusSettingDateTime)
                        .ThenBy(departureStatus => departureStatus.Id)
                        .Select(departureStatus => (DateTime?)departureStatus.StatusSettingDateTime)
                        .FirstOrDefault(),
                    SubmittedAt = departure.DepartureStatuses
                        .Where(departureStatus => departureStatus.StatusId == (int)FlightStatusId.AwaitingApproval)
                        .OrderBy(departureStatus => departureStatus.StatusSettingDateTime)
                        .ThenBy(departureStatus => departureStatus.Id)
                        .Select(departureStatus => (DateTime?)departureStatus.StatusSettingDateTime)
                        .FirstOrDefault(),

                    CharterRequesterEmail = departure.CharterRequester.Email,
                    CharterRequesterFirstName = departure.CharterRequester.Person == null
                        ? null
                        : departure.CharterRequester.Person.FirstName,
                    CharterRequesterLastName = departure.CharterRequester.Person == null
                        ? null
                        : departure.CharterRequester.Person.LastName,
                    CharterRequesterPatronymic = departure.CharterRequester.Person == null
                        ? null
                        : departure.CharterRequester.Person.Patronymic,
                    PassengerCount = departure.People.Count,

                    HasContractDocument = departure.ContractDocumentFileName != null ||
                        departure.ContractDocumentUploadedAt != null,
                    departure.ContractDocumentFileName,
                    departure.ContractDocumentUploadedAt,
                    ContractDocumentUploadedByAirline = departure.ContractDocumentUploadedByUserId != null &&
                        _context.Users.Any(user =>
                            user.Id == departure.ContractDocumentUploadedByUserId &&
                            user.AirlineId == departure.Plane.AirlineId),
                    PaymentDeadlineDays = departure.Plane.Airline.PaymentDeadlineDays
                })
                .ToListAsync(cancellationToken);

            var filteredDepartureRows = departureRows
                .Where(departure => departure.CurrentStatus is not null &&
                    IsDepartureInManagementSection(departure.CurrentStatus.StatusId, managementSection))
                .ToList();

            int[] departureIds = filteredDepartureRows
                .Select(departure => departure.Id)
                .ToArray();

            if (departureIds.Length == 0)
                return Ok(Array.Empty<ManagementDepartureResponse>());

            var passengerRows = await _context.Departures
                .AsNoTracking()
                .Where(departure => departureIds.Contains(departure.Id))
                .SelectMany(departure => departure.People.Select(person => new
                {
                    DepartureId = departure.Id,
                    person.Id,
                    person.FirstName,
                    person.LastName,
                    person.Patronymic,
                    PersonEmail = person.Email,
                    UserEmail = person.Users
                        .OrderBy(user => user.Id)
                        .Select(user => user.Email)
                        .FirstOrDefault()
                }))
                .ToListAsync(cancellationToken);

            var employeeRows = await _context.Departures
                .AsNoTracking()
                .Where(departure => departureIds.Contains(departure.Id))
                .SelectMany(departure => departure.Employees.Select(employee => new
                {
                    DepartureId = departure.Id,
                    employee.Id,
                    employee.Email,
                    RoleName = employee.Role.Name,
                    FirstName = employee.Person == null ? null : employee.Person.FirstName,
                    LastName = employee.Person == null ? null : employee.Person.LastName,
                    Patronymic = employee.Person == null ? null : employee.Person.Patronymic
                }))
                .ToListAsync(cancellationToken);

            var statusRows = await _context.DepartureStatuses
                .AsNoTracking()
                .Where(departureStatus => departureIds.Contains(departureStatus.DepartureId))
                .OrderBy(departureStatus => departureStatus.StatusSettingDateTime)
                .ThenBy(departureStatus => departureStatus.Id)
                .Select(departureStatus => new
                {
                    departureStatus.DepartureId,
                    Status = new ManagementDepartureStatusResponse
                    {
                        Id = departureStatus.StatusId,
                        Name = departureStatus.Status.Status1,
                        SetAt = departureStatus.StatusSettingDateTime
                    }
                })
                .ToListAsync(cancellationToken);

            var routeLegRows = await _context.DepartureRouteLegs
                .AsNoTracking()
                .Where(routeLeg => departureIds.Contains(routeLeg.DepartureId))
                .OrderBy(routeLeg => routeLeg.SequenceNumber)
                .Select(routeLeg => new ManagementDepartureRouteLegListItem
                {
                    DepartureId = routeLeg.DepartureId,
                    SequenceNumber = routeLeg.SequenceNumber,
                    FromAirport = new AirportSearchResponse
                    {
                        Id = routeLeg.FromAirport.Id,
                        Name = routeLeg.FromAirport.Name,
                        City = routeLeg.FromAirport.City,
                        Country = routeLeg.FromAirport.Country,
                        Iata = routeLeg.FromAirport.Iata,
                        Icao = routeLeg.FromAirport.Icao,
                        Latitude = routeLeg.FromAirport.Latitude,
                        Longitude = routeLeg.FromAirport.Longitude
                    },
                    ToAirport = new AirportSearchResponse
                    {
                        Id = routeLeg.ToAirport.Id,
                        Name = routeLeg.ToAirport.Name,
                        City = routeLeg.ToAirport.City,
                        Country = routeLeg.ToAirport.Country,
                        Iata = routeLeg.ToAirport.Iata,
                        Icao = routeLeg.ToAirport.Icao,
                        Latitude = routeLeg.ToAirport.Latitude,
                        Longitude = routeLeg.ToAirport.Longitude
                    },
                    Leg = new RouteLegResponse
                    {
                        FromAirportId = routeLeg.FromAirportId,
                        ToAirportId = routeLeg.ToAirportId,
                        DistanceKm = routeLeg.Distance,
                        FlightTime = routeLeg.FlightTime,
                        FlightCost = routeLeg.FlightCost,
                        GroundTimeAfterArrival = routeLeg.GroundTimeAfterArrival
                    }
                })
                .ToListAsync(cancellationToken);

            Dictionary<int, IReadOnlyCollection<ManagementPassengerResponse>> passengersByDepartureId = passengerRows
                .GroupBy(passenger => passenger.DepartureId)
                .ToDictionary(
                    group => group.Key,
                    group => (IReadOnlyCollection<ManagementPassengerResponse>)group
                        .OrderBy(passenger => passenger.LastName)
                        .ThenBy(passenger => passenger.FirstName)
                        .Select(passenger => new ManagementPassengerResponse
                        {
                            Id = passenger.Id,
                            FullName = BuildPersonFullName(
                                passenger.LastName,
                                passenger.FirstName,
                                passenger.Patronymic),
                            Email = !string.IsNullOrWhiteSpace(passenger.PersonEmail)
                                ? passenger.PersonEmail
                                : passenger.UserEmail
                        })
                        .ToArray());

            Dictionary<int, IReadOnlyCollection<ManagementDepartureStatusResponse>> statusesByDepartureId = statusRows
                .GroupBy(status => status.DepartureId)
                .ToDictionary(
                    group => group.Key,
                    group => (IReadOnlyCollection<ManagementDepartureStatusResponse>)group
                        .Select(status => status.Status)
                        .ToArray());

            Dictionary<int, IReadOnlyCollection<ManagementEmployeeResponse>> employeesByDepartureId = employeeRows
                .GroupBy(employee => employee.DepartureId)
                .ToDictionary(
                    group => group.Key,
                    group => (IReadOnlyCollection<ManagementEmployeeResponse>)group
                        .OrderBy(employee => employee.LastName)
                        .ThenBy(employee => employee.FirstName)
                        .ThenBy(employee => employee.Email)
                        .Select(employee => new ManagementEmployeeResponse
                        {
                            Id = employee.Id,
                            Email = employee.Email,
                            RoleName = employee.RoleName,
                            FullName = BuildPersonFullName(
                                employee.LastName,
                                employee.FirstName,
                                employee.Patronymic)
                        })
                        .ToArray());

            Dictionary<int, List<ManagementDepartureRouteLegListItem>> routeRowsByDepartureId = routeLegRows
                .GroupBy(routeLeg => routeLeg.DepartureId)
                .ToDictionary(
                    group => group.Key,
                    group => group
                        .OrderBy(routeLeg => routeLeg.SequenceNumber)
                        .ToList());

            List<ManagementDepartureResponse> responses = filteredDepartureRows
                .Select(departure =>
                {
                    IReadOnlyCollection<ManagementPassengerResponse> passengers =
                        passengersByDepartureId.GetValueOrDefault(
                            departure.Id,
                            Array.Empty<ManagementPassengerResponse>());
                    IReadOnlyCollection<ManagementDepartureStatusResponse> statusHistory =
                        statusesByDepartureId.GetValueOrDefault(
                            departure.Id,
                            Array.Empty<ManagementDepartureStatusResponse>());
                    IReadOnlyCollection<ManagementEmployeeResponse> employees =
                        employeesByDepartureId.GetValueOrDefault(
                            departure.Id,
                            Array.Empty<ManagementEmployeeResponse>());
                    IReadOnlyCollection<RouteLegResponse> routeLegs = CreateListRouteLegResponses(
                        routeRowsByDepartureId.GetValueOrDefault(departure.Id));
                    IReadOnlyCollection<AirportSearchResponse> routeAirports = CreateListRouteAirportResponses(
                        routeRowsByDepartureId.GetValueOrDefault(departure.Id));
                    bool hasEditAccess = CanCurrentUserEditManagementDepartures();
                    bool canEditByStatus =
                        departure.CurrentStatus!.StatusId == (int)FlightStatusId.InCreation ||
                        departure.CurrentStatus.StatusId == (int)FlightStatusId.AwaitingApproval;

                    return new ManagementDepartureResponse
                    {
                        Id = departure.Id,
                        PlaneModelName = departure.PlaneModelName,
                        PlanePassengerCapacity = departure.PlanePassengerCapacity,
                        PlaneImage = null,
                        AirlineName = departure.AirlineName,
                        AirlineEmail = departure.AirlineEmail,
                        AirlinePhoneNumber = departure.AirlinePhoneNumber,
                        AirlineImage = null,

                        TakeOffAirportId = departure.TakeOffAirportId,
                        TakeOffAirportName = departure.TakeOffAirportName,
                        TakeOffAirportCity = departure.TakeOffAirportCity,
                        TakeOffAirportIata = departure.TakeOffAirportIata,
                        TakeOffAirportIcao = departure.TakeOffAirportIcao,

                        LandingAirportId = departure.LandingAirportId,
                        LandingAirportName = departure.LandingAirportName,
                        LandingAirportCity = departure.LandingAirportCity,
                        LandingAirportIata = departure.LandingAirportIata,
                        LandingAirportIcao = departure.LandingAirportIcao,

                        RequestedTakeOffDateTime = departure.RequestedTakeOffDateTime,
                        ArrivalDateTime = departure.RequestedTakeOffDateTime.Add(departure.FlightTime),
                        CreatedAt = departure.CreatedAt,
                        SubmittedAt = departure.SubmittedAt,
                        Price = departure.Price,
                        Distance = departure.Distance,
                        FlightTime = departure.FlightTime,
                        Transfers = departure.Transfers,

                        CurrentStatusId = departure.CurrentStatus.StatusId,
                        StatusName = departure.CurrentStatus.StatusName,
                        CurrentStatusSetAt = departure.CurrentStatus.StatusSettingDateTime,
                        CharterRequesterEmail = departure.CharterRequesterEmail,
                        CharterRequesterFullName = BuildPersonFullName(
                            departure.CharterRequesterLastName,
                            departure.CharterRequesterFirstName,
                            departure.CharterRequesterPatronymic),
                        PassengerCount = departure.PassengerCount,
                        CanEditRoute = canEditByStatus && hasEditAccess,
                        CanApprove = departure.CurrentStatus.StatusId == (int)FlightStatusId.AwaitingApproval && hasEditAccess,
                        CanChangeStatus = IsActiveFlightStatus(departure.CurrentStatus.StatusId) && hasEditAccess,
                        CanDelete = CanRequesterDeleteDeparture(departure.CurrentStatus.StatusId),
                        CanPay = departure.CurrentStatus.StatusId == (int)FlightStatusId.AwaitingPayment,
                        PaymentDeadlineAt = CalculatePaymentDeadlineAtFromResponses(
                            statusHistory,
                            departure.PaymentDeadlineDays),
                        HasContractDocument = departure.HasContractDocument,
                        ContractDocumentFileName = departure.ContractDocumentFileName,
                        ContractDocumentUploadedAt = departure.ContractDocumentUploadedAt,
                        ContractDocumentUploadedByAirline = departure.ContractDocumentUploadedByAirline,

                        Passengers = passengers,
                        Employees = employees,
                        StatusHistory = statusHistory,
                        RouteAirports = routeAirports,
                        RouteLegs = routeLegs
                    };
                })
                .ToList();

            return Ok(responses);
        }

        [HttpGet("management/{departureId:int}")]
        [Authorize(Roles = ManagementViewerRoles)]
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

            return Ok(CreateManagementDepartureResponse(
                departure,
                currentStatus,
                isManagementView: true));
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

        [HttpDelete("my/{departureId:int}")]
        public async Task<IActionResult> DeleteMyDeparture(
            int departureId,
            CancellationToken cancellationToken)
        {
            int? userId = GetCurrentUserId();

            if (userId is null)
                return Unauthorized();

            Departure? departure = await _context.Departures
                .Include(departure => departure.DepartureStatuses)
                .Include(departure => departure.DepartureRouteLegs)
                .FirstOrDefaultAsync(
                    departure => departure.Id == departureId &&
                        departure.CharterRequesterId == userId.Value,
                    cancellationToken);

            if (departure is null)
                return NotFound();

            DepartureStatus? currentStatus = GetCurrentStatus(departure);

            if (currentStatus is null)
                return NotFound();

            if (!CanRequesterDeleteDeparture(currentStatus.StatusId))
                return BadRequest("Заявку можно удалить только в статусе создания или ожидания одобрения.");

            await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

            await _context.Database.ExecuteSqlInterpolatedAsync(
                $"DELETE FROM passenger_departure WHERE departure_id = {departure.Id}",
                cancellationToken);

            await _context.Database.ExecuteSqlInterpolatedAsync(
                $"DELETE FROM departure_employees WHERE departure_id = {departure.Id}",
                cancellationToken);

            _context.DepartureRouteLegs.RemoveRange(departure.DepartureRouteLegs);
            _context.DepartureStatuses.RemoveRange(departure.DepartureStatuses);
            _context.Departures.Remove(departure);

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return NoContent();
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

        [HttpPost("my/{departureId:int}/submit")]
        public async Task<IActionResult> SubmitMyDeparture(
            int departureId,
            CancellationToken cancellationToken)
        {
            int? userId = GetCurrentUserId();

            if (userId is null)
                return Unauthorized();

            Departure? departure = await GetManagementDepartureQuery()
                .FirstOrDefaultAsync(
                    departure => departure.Id == departureId &&
                        departure.CharterRequesterId == userId.Value,
                    cancellationToken);

            if (departure is null)
                return NotFound();

            DepartureStatus? currentStatus = GetCurrentStatus(departure);

            if (currentStatus?.StatusId != (int)FlightStatusId.InCreation)
                return BadRequest("Заявку можно отправить только из статуса создания.");

            if (departure.People.Count == 0)
                return BadRequest("Добавьте хотя бы одного пассажира.");

            if (departure.DepartureRouteLegs.Count == 0)
                return BadRequest("Маршрут заявки не рассчитан.");

            if (IsRequestedTakeOffDateTimeTooEarly(departure.RequestedTakeOffDateTime))
                return BadRequest("Дата и время вылета должны быть не раньше завтрашнего дня.");

            AddDepartureStatus(departure, FlightStatusId.AwaitingApproval);
            await _context.SaveChangesAsync(cancellationToken);

            return NoContent();
        }

        [HttpPost("management/{departureId:int}/approve")]
        [Authorize(Roles = ManagementEditorRoles)]
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

            if (IsRequestedTakeOffDateTimeTooEarly(departure.RequestedTakeOffDateTime))
                return BadRequest("Дата и время вылета должны быть не раньше завтрашнего дня.");

            AddDepartureStatus(departure, FlightStatusId.AwaitingContractSigning);
            await _context.SaveChangesAsync(cancellationToken);

            return NoContent();
        }

        [HttpPost("management/{departureId:int}/approve-route")]
        [Authorize(Roles = ManagementEditorRoles)]
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

            if (IsRequestedTakeOffDateTimeTooEarly(departure.RequestedTakeOffDateTime))
                return BadRequest("Дата и время вылета должны быть не раньше завтрашнего дня.");

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

            AddDepartureStatus(departure, FlightStatusId.AwaitingContractSigning);
            await _context.SaveChangesAsync(cancellationToken);

            return NoContent();
        }

        [HttpPost("management/{departureId:int}/confirm-contract-document")]
        [Authorize(Roles = ManagementEditorRoles)]
        public async Task<IActionResult> ConfirmManagementDepartureContractDocument(
            int departureId,
            CancellationToken cancellationToken)
        {
            Departure? departure = await GetEditableManagementDepartureAsync(
                departureId,
                cancellationToken);

            if (departure is null)
                return NotFound();

            DepartureStatus? currentStatus = GetCurrentStatus(departure);

            if (currentStatus?.StatusId != (int)FlightStatusId.AwaitingContractSigning)
                return BadRequest("Договор можно подтвердить только в статусе ожидания подписания договора.");

            if (departure.ContractDocument is null || departure.ContractDocument.Length == 0)
                return BadRequest("Подписанный договор ещё не загружен.");

            if (!await IsContractDocumentUploadedByAirlineAsync(departure, cancellationToken))
                return BadRequest("Перед подтверждением менеджер должен загрузить подписанный договор.");

            AddDepartureStatus(departure, FlightStatusId.AwaitingPayment);
            await _context.SaveChangesAsync(cancellationToken);

            return NoContent();
        }

        [HttpPost("my/{departureId:int}/pay")]
        public async Task<IActionResult> PayMyDeparture(
            int departureId,
            CancellationToken cancellationToken)
        {
            int? userId = GetCurrentUserId();

            if (userId is null)
                return Unauthorized();

            Departure? departure = await GetManagementDepartureQuery()
                .FirstOrDefaultAsync(
                    departure => departure.Id == departureId &&
                        departure.CharterRequesterId == userId.Value,
                    cancellationToken);

            if (departure is null)
                return NotFound();

            DepartureStatus? currentStatus = GetCurrentStatus(departure);

            if (currentStatus?.StatusId != (int)FlightStatusId.AwaitingPayment)
                return BadRequest("Оплата доступна только в статусе ожидания оплаты.");

            DateTime? paymentDeadlineAt = CalculatePaymentDeadlineAt(
                departure.DepartureStatuses,
                departure.Plane.Airline.PaymentDeadlineDays);

            if (paymentDeadlineAt is not null && DateTime.UtcNow > paymentDeadlineAt.Value)
            {
                AddDepartureStatus(departure, FlightStatusId.Cancelled);
                await _context.SaveChangesAsync(cancellationToken);
                return BadRequest("Срок оплаты истёк. Вылет отменён.");
            }

            AddDepartureStatus(departure, FlightStatusId.Scheduled);
            await _context.SaveChangesAsync(cancellationToken);

            return NoContent();
        }

        [HttpPost("management/{departureId:int}/status")]
        [Authorize(Roles = ManagementEditorRoles)]
        public async Task<IActionResult> UpdateManagementDepartureStatus(
            int departureId,
            [FromBody] UpdateManagementDepartureStatusRequest request,
            CancellationToken cancellationToken)
        {
            int? userAirlineId = await GetCurrentUserAirlineIdAsync(cancellationToken);

            if (userAirlineId is null)
                return Forbid();

            if (!Enum.IsDefined(typeof(FlightStatusId), request.StatusId))
                return BadRequest("Unknown status.");

            FlightStatusId nextStatusId = (FlightStatusId)request.StatusId;

            if (!IsOperationalStatus(nextStatusId))
                return BadRequest("Status cannot be set from flight management.");

            Departure? departure = await GetManagementDepartureQuery()
                .FirstOrDefaultAsync(
                    departure => departure.Id == departureId,
                    cancellationToken);

            if (departure is null)
                return NotFound();

            if (departure.Plane.AirlineId != userAirlineId.Value)
                return Forbid();

            DepartureStatus? currentStatus = GetCurrentStatus(departure);

            if (currentStatus is null || !IsActiveFlightStatus(currentStatus.StatusId))
                return BadRequest("Flight status cannot be changed now.");

            if (request.IncludePreviousStatuses)
            {
                if (IsStatusAlreadyPastCatchUpTarget(
                    departure,
                    (FlightStatusId)currentStatus.StatusId,
                    nextStatusId,
                    departure.DepartureRouteLegs.Count,
                    request.TargetLegIndex))
                {
                    return BadRequest("Current status is already ahead of the calculated status.");
                }

                IReadOnlyCollection<FlightStatusId> catchUpSequence = BuildOperationalStatusCatchUpSequence(
                    departure,
                    (FlightStatusId)currentStatus.StatusId,
                    nextStatusId,
                    departure.DepartureRouteLegs.Count,
                    request.TargetLegIndex);

                if (RequiresCrewBeforeDeparture(catchUpSequence) && departure.Employees.Count == 0)
                    return BadRequest("Для вылета назначьте хотя бы одного члена экипажа.");

                foreach (FlightStatusId statusId in catchUpSequence)
                {
                    AddDepartureStatus(departure, statusId);
                }

                await _context.SaveChangesAsync(cancellationToken);
                return NoContent();
            }

            if (currentStatus.StatusId != request.StatusId)
            {
                if (RequiresCrewBeforeDeparture(nextStatusId) && departure.Employees.Count == 0)
                    return BadRequest("Для вылета назначьте хотя бы одного члена экипажа.");

                AddDepartureStatus(departure, nextStatusId);
                await _context.SaveChangesAsync(cancellationToken);
            }

            return NoContent();
        }

        [HttpDelete("management/{departureId:int}/status/latest")]
        [Authorize(Roles = ManagementEditorRoles)]
        public async Task<IActionResult> DeleteLatestManagementDepartureStatus(
            int departureId,
            CancellationToken cancellationToken)
        {
            int? userAirlineId = await GetCurrentUserAirlineIdAsync(cancellationToken);

            if (userAirlineId is null)
                return Forbid();

            Departure? departure = await GetManagementDepartureQuery()
                .FirstOrDefaultAsync(
                    departure => departure.Id == departureId,
                    cancellationToken);

            if (departure is null)
                return NotFound();

            if (departure.Plane.AirlineId != userAirlineId.Value)
                return Forbid();

            DepartureStatus? currentStatus = GetCurrentStatus(departure);

            if (currentStatus is null)
                return BadRequest("Flight has no status.");

            if (currentStatus.StatusId <= (int)FlightStatusId.Planned)
                return BadRequest("This status cannot be deleted.");

            _context.DepartureStatuses.Remove(currentStatus);
            await _context.SaveChangesAsync(cancellationToken);

            return NoContent();
        }

        [HttpPost("management/{departureId:int}/route")]
        [Authorize(Roles = ManagementEditorRoles)]
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
        [Authorize(Roles = ManagementEditorRoles)]
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

        [HttpPost("management/{departureId:int}/take-off-date-time")]
        [Authorize(Roles = ManagementEditorRoles)]
        public async Task<IActionResult> UpdateManagementDepartureTakeOffDateTime(
            int departureId,
            UpdateDepartureTakeOffDateTimeRequest request,
            CancellationToken cancellationToken)
        {
            Departure? departure = await GetEditableManagementDepartureAsync(
                departureId,
                cancellationToken);

            if (departure is null)
                return NotFound();

            DepartureStatus? currentStatus = GetCurrentStatus(departure);

            if (currentStatus?.StatusId != (int)FlightStatusId.AwaitingApproval)
                return BadRequest("Дату и время вылета можно редактировать только до одобрения заявки.");

            if (IsRequestedTakeOffDateTimeTooEarly(request.RequestedTakeOffDateTime))
                return BadRequest("Дата и время вылета должны быть не раньше завтрашнего дня.");

            departure.RequestedTakeOffDateTime = request.RequestedTakeOffDateTime;

            await _context.SaveChangesAsync(cancellationToken);

            return NoContent();
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

        [HttpPost("my/{departureId:int}/take-off-date-time")]
        public async Task<IActionResult> UpdateMyDepartureTakeOffDateTime(
            int departureId,
            UpdateDepartureTakeOffDateTimeRequest request,
            CancellationToken cancellationToken)
        {
            Departure? departure = await GetEditableRequesterDepartureAsync(
                departureId,
                cancellationToken);

            if (departure is null)
                return NotFound();

            if (IsRequestedTakeOffDateTimeTooEarly(request.RequestedTakeOffDateTime))
                return BadRequest("Дата и время вылета должны быть не раньше завтрашнего дня.");

            departure.RequestedTakeOffDateTime = request.RequestedTakeOffDateTime;

            await _context.SaveChangesAsync(cancellationToken);

            return NoContent();
        }

        [HttpGet("management/{departureId:int}/route-candidates")]
        [Authorize(Roles = ManagementEditorRoles)]
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
        [Authorize(Roles = ManagementEditorRoles)]
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

        [HttpPut("management/{departureId:int}/employees")]
        [Authorize(Roles = ManagementEditorRoles)]
        public async Task<IActionResult> UpdateManagementDepartureEmployees(
            int departureId,
            [FromBody] UpdateDepartureEmployeesRequest request,
            CancellationToken cancellationToken)
        {
            int? userAirlineId = await GetCurrentUserAirlineIdAsync(cancellationToken);

            if (userAirlineId is null)
                return Forbid();

            Departure? departure = await GetManagementDepartureQuery()
                .FirstOrDefaultAsync(
                    departure => departure.Id == departureId,
                    cancellationToken);

            if (departure is null)
                return NotFound();

            if (departure.Plane.AirlineId != userAirlineId.Value)
                return Forbid();

            int[] employeeIds = request.EmployeeIds
                .Distinct()
                .ToArray();

            User[] employees = await _context.Users
                .Include(user => user.Role)
                .Include(user => user.DeparturesNavigation)
                .Where(user =>
                    employeeIds.Contains(user.Id) &&
                    user.AirlineId == userAirlineId.Value &&
                    user.IsActive)
                .ToArrayAsync(cancellationToken);

            if (employees.Length != employeeIds.Length)
                return BadRequest("Один или несколько сотрудников не найдены в вашей авиакомпании.");

            if (employees.Any(employee => employee.Role.Name == "Client"))
                return BadRequest("К вылету можно прикреплять только сотрудников авиакомпании.");

            DateTime departureStart = departure.RequestedTakeOffDateTime;
            DateTime departureEnd = departureStart.Add(departure.FlightTime);

            if (employees.Any(employee => employee.DeparturesNavigation.Any(employeeDeparture =>
                employeeDeparture.Id != departureId &&
                employeeDeparture.RequestedTakeOffDateTime < departureEnd &&
                departureStart < employeeDeparture.RequestedTakeOffDateTime.Add(employeeDeparture.FlightTime))))
                return BadRequest("Один или несколько сотрудников уже назначены на другой вылет.");

            if (HasDepartureStarted(departure) && employeeIds.Length == 0)
                return BadRequest("После вылета должен остаться хотя бы один член экипажа.");

            departure.Employees.Clear();

            foreach (User employee in employees)
                departure.Employees.Add(employee);

            await _context.SaveChangesAsync(cancellationToken);

            return NoContent();
        }

        private ManagementDepartureResponse? CreateManagementDepartureResponse(
            Departure departure,
            ManagementDepartureSection section,
            bool isManagementView = false)
        {
            DepartureStatus? currentStatus = GetCurrentStatus(departure);

            if (currentStatus is null || !IsDepartureInManagementSection(currentStatus.StatusId, section))
                return null;

            return CreateManagementDepartureResponse(departure, currentStatus, isManagementView);
        }

        private ManagementDepartureResponse? CreateManagementDepartureResponse(
            Departure departure,
            bool isManagementView = false)
        {
            DepartureStatus? currentStatus = GetCurrentStatus(departure);

            if (currentStatus is null || currentStatus.StatusId == (int)FlightStatusId.InCreation)
                return null;

            return CreateManagementDepartureResponse(departure, currentStatus, isManagementView);
        }

        private ManagementDepartureResponse CreateManagementDepartureResponse(
            Departure departure,
            DepartureStatus currentStatus,
            bool isManagementView = false)
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
            bool hasEditAccess = !isManagementView || CanCurrentUserEditManagementDepartures();
            bool canEditByStatus =
                currentStatus.StatusId == (int)FlightStatusId.InCreation ||
                currentStatus.StatusId == (int)FlightStatusId.AwaitingApproval;

            return new ManagementDepartureResponse
            {
                Id = departure.Id,
                PlaneModelName = departure.Plane.ModelName,
                PlanePassengerCapacity = departure.Plane.PassengerCapacity,
                PlaneImage = departure.Plane.Image == null ? null : Convert.ToBase64String(departure.Plane.Image),
                AirlineName = departure.Plane.Airline.AirlineName,
                AirlineEmail = departure.Plane.Airline.Email,
                AirlinePhoneNumber = departure.Plane.Airline.PhoneNumber,
                AirlineImage = departure.Plane.Airline.Image == null ? null : Convert.ToBase64String(departure.Plane.Airline.Image),

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
                SubmittedAt = statusHistory
                    .FirstOrDefault(status => status.Id == (int)FlightStatusId.AwaitingApproval)
                    ?.SetAt,
                Price = routeTotals.Price,
                Distance = routeTotals.Distance,
                FlightTime = routeTotals.FlightTime,
                Transfers = routeTotals.Transfers,

                CurrentStatusId = currentStatus.StatusId,
                StatusName = currentStatus.Status.Status1,
                CurrentStatusSetAt = currentStatus.StatusSettingDateTime,
                CharterRequesterEmail = departure.CharterRequester.Email,
                CharterRequesterFullName = departure.CharterRequester.Person is null
                    ? null
                    : BuildPersonFullName(departure.CharterRequester.Person),
                PassengerCount = departure.People.Count,
                CanEditRoute = canEditByStatus && hasEditAccess,
                CanApprove = currentStatus.StatusId == (int)FlightStatusId.AwaitingApproval && hasEditAccess,
                CanChangeStatus = IsActiveFlightStatus(currentStatus.StatusId) && hasEditAccess,
                CanDelete = CanRequesterDeleteDeparture(currentStatus.StatusId),
                CanPay = currentStatus.StatusId == (int)FlightStatusId.AwaitingPayment,
                PaymentDeadlineAt = CalculatePaymentDeadlineAt(
                    departure.DepartureStatuses,
                    departure.Plane.Airline.PaymentDeadlineDays),
                HasContractDocument = departure.ContractDocument != null && departure.ContractDocument.Length > 0,
                ContractDocumentFileName = departure.ContractDocumentFileName,
                ContractDocumentUploadedAt = departure.ContractDocumentUploadedAt,
                ContractDocumentUploadedByAirline = IsContractDocumentUploadedByAirline(departure),

                Passengers = departure.People
                    .OrderBy(person => person.LastName)
                    .ThenBy(person => person.FirstName)
                    .Select(person => new ManagementPassengerResponse
                    {
                        Id = person.Id,
                        FullName = BuildPersonFullName(person),
                        Email = GetPassengerEmail(person)
                    })
                    .ToArray(),
                Employees = departure.Employees
                    .OrderBy(employee => employee.Person == null ? employee.Email : employee.Person.LastName)
                    .ThenBy(employee => employee.Person == null ? employee.Email : employee.Person.FirstName)
                    .Select(employee => new ManagementEmployeeResponse
                    {
                        Id = employee.Id,
                        Email = employee.Email,
                        RoleName = employee.Role.Name,
                        FullName = employee.Person == null
                            ? null
                            : BuildPersonFullName(employee.Person)
                    })
                    .ToArray(),
                StatusHistory = statusHistory,
                RouteAirports = CreateRouteAirportResponses(departure),
                RouteLegs = CreateRouteLegResponses(departure)
            };
        }

        private bool CanCurrentUserEditManagementDepartures()
        {
            return User.IsInRole("Owner") ||
                User.IsInRole("Manager") ||
                User.IsInRole("Admin") ||
                User.IsInRole("GeneralDirector") ||
                User.IsInRole("Employee");
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

        private static IReadOnlyCollection<AirportSearchResponse> CreateListRouteAirportResponses(
            IReadOnlyCollection<ManagementDepartureRouteLegListItem>? routeLegs)
        {
            if (routeLegs is null || routeLegs.Count == 0)
                return Array.Empty<AirportSearchResponse>();

            List<ManagementDepartureRouteLegListItem> orderedRouteLegs = routeLegs
                .OrderBy(routeLeg => routeLeg.SequenceNumber)
                .ToList();
            List<AirportSearchResponse> routeAirports = new List<AirportSearchResponse>
            {
                orderedRouteLegs[0].FromAirport
            };

            foreach (ManagementDepartureRouteLegListItem routeLeg in orderedRouteLegs)
                routeAirports.Add(routeLeg.ToAirport);

            return routeAirports;
        }

        private static IReadOnlyCollection<RouteLegResponse> CreateListRouteLegResponses(
            IReadOnlyCollection<ManagementDepartureRouteLegListItem>? routeLegs)
        {
            if (routeLegs is null || routeLegs.Count == 0)
                return Array.Empty<RouteLegResponse>();

            return routeLegs
                .OrderBy(routeLeg => routeLeg.SequenceNumber)
                .Select(routeLeg => routeLeg.Leg)
                .ToArray();
        }

        private IQueryable<Departure> GetManagementDepartureQuery()
        {
            return _context.Departures
                .AsSplitQuery()
                .Include(departure => departure.Plane)
                    .ThenInclude(plane => plane.Airline)
                .Include(departure => departure.TakeOffAirport)
                .Include(departure => departure.LandingAirport)
                .Include(departure => departure.CharterRequester)
                    .ThenInclude(user => user.Person)
                .Include(departure => departure.People)
                    .ThenInclude(person => person.Users)
                .Include(departure => departure.Employees)
                    .ThenInclude(employee => employee.Role)
                .Include(departure => departure.Employees)
                    .ThenInclude(employee => employee.Person)
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

        private static string CreateContractMissingDataMessage(IReadOnlyCollection<string> missingFields)
        {
            if (missingFields.Any(field => field.Contains("профиль заказчика", StringComparison.OrdinalIgnoreCase)))
                return "Для формирования договора заполните данные в профиле.";

            return "Для формирования договора заполните недостающие данные: " +
                string.Join(", ", missingFields) + ".";
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
                    currentStatusId == (int)FlightStatusId.AwaitingApproval ||
                    currentStatusId == (int)FlightStatusId.AwaitingContractSigning ||
                    currentStatusId == (int)FlightStatusId.AwaitingPayment,

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

        private static bool CanRequesterDeleteDeparture(int currentStatusId)
        {
            return currentStatusId is
                (int)FlightStatusId.InCreation or
                (int)FlightStatusId.AwaitingApproval;
        }

        private static bool IsActiveFlightStatus(int currentStatusId)
        {
            return currentStatusId is >= (int)FlightStatusId.Scheduled and <= (int)FlightStatusId.EnRoute
                or (int)FlightStatusId.Delayed
                or (int)FlightStatusId.Redirected
                or (int)FlightStatusId.IntermediateStop;
        }

        private static bool IsOperationalStatus(FlightStatusId statusId)
        {
            return statusId is
                FlightStatusId.Scheduled or
                FlightStatusId.Planned or
                FlightStatusId.RegistrationOpen or
                FlightStatusId.RegistrationClosing or
                FlightStatusId.RegistrationClosed or
                FlightStatusId.AwaitingBoarding or
                FlightStatusId.Boarding or
                FlightStatusId.GateOpen or
                FlightStatusId.GateClosed or
                FlightStatusId.BoardingCompleted or
                FlightStatusId.EnRoute or
                FlightStatusId.Landed or
                FlightStatusId.Delayed or
                FlightStatusId.Redirected or
                FlightStatusId.Cancelled or
                FlightStatusId.IntermediateStop;
        }

        private static bool RequiresCrewBeforeDeparture(FlightStatusId statusId)
        {
            return statusId is FlightStatusId.EnRoute;
        }

        private static bool RequiresCrewBeforeDeparture(IEnumerable<FlightStatusId> statusIds)
        {
            return statusIds.Any(RequiresCrewBeforeDeparture);
        }

        private static bool HasDepartureStarted(Departure departure)
        {
            return departure.DepartureStatuses.Any(departureStatus =>
                departureStatus.StatusId == (int)FlightStatusId.EnRoute);
        }

        private static IReadOnlyCollection<FlightStatusId> BuildOperationalStatusCatchUpSequence(
            Departure departure,
            FlightStatusId currentStatusId,
            FlightStatusId targetStatusId,
            int routeLegCount,
            int? targetLegIndex)
        {
            IReadOnlyList<FlightStatusId> sequence = BuildOperationalStatusSequence(
                routeLegCount,
                targetLegIndex,
                targetStatusId);
            int currentIndex = FindCurrentStatusIndex(sequence, departure, currentStatusId);
            int targetIndex = FindLastStatusIndex(sequence, targetStatusId);

            if (targetIndex < 0)
                return Array.Empty<FlightStatusId>();

            if (currentIndex < 0)
                currentIndex = -1;

            if (targetIndex <= currentIndex)
                return Array.Empty<FlightStatusId>();

            return sequence
                .Skip(currentIndex + 1)
                .Take(targetIndex - currentIndex)
                .ToArray();
        }

        private static bool IsStatusAlreadyPastCatchUpTarget(
            Departure departure,
            FlightStatusId currentStatusId,
            FlightStatusId targetStatusId,
            int routeLegCount,
            int? targetLegIndex)
        {
            IReadOnlyList<FlightStatusId> sequence = BuildOperationalStatusSequence(routeLegCount, targetLegIndex, targetStatusId);
            int currentIndex = FindCurrentStatusIndex(sequence, departure, currentStatusId);
            int targetIndex = FindLastStatusIndex(sequence, targetStatusId);

            if (targetIndex < 0)
                return true;

            if (currentIndex < 0)
                return true;

            return currentIndex > targetIndex;
        }

        private static IReadOnlyList<FlightStatusId> BuildOperationalStatusSequence(
            int routeLegCount,
            int? targetLegIndex,
            FlightStatusId targetStatusId)
        {
            List<FlightStatusId> fullSequence = new()
            {
                FlightStatusId.Scheduled,
                FlightStatusId.Planned,
                FlightStatusId.RegistrationOpen,
                FlightStatusId.RegistrationClosing,
                FlightStatusId.RegistrationClosed,
                FlightStatusId.AwaitingBoarding,
                FlightStatusId.Boarding,
                FlightStatusId.GateOpen,
                FlightStatusId.GateClosed,
                FlightStatusId.BoardingCompleted,
                FlightStatusId.EnRoute
            };

            int normalizedRouteLegCount = Math.Max(1, routeLegCount);
            int normalizedTargetLegIndex = Math.Clamp(targetLegIndex ?? 0, 0, normalizedRouteLegCount - 1);

            for (int legIndex = 0; legIndex < normalizedTargetLegIndex; legIndex++)
            {
                fullSequence.Add(FlightStatusId.IntermediateStop);
                fullSequence.Add(FlightStatusId.EnRoute);
            }

            if (targetStatusId == FlightStatusId.IntermediateStop)
            {
                fullSequence.Add(FlightStatusId.IntermediateStop);
            }
            else if (targetStatusId == FlightStatusId.Landed)
            {
                fullSequence.Add(FlightStatusId.Landed);
            }

            return fullSequence;
        }

        private static int FindCurrentStatusIndex(
            IReadOnlyList<FlightStatusId> sequence,
            Departure departure,
            FlightStatusId statusId)
        {
            if (statusId is FlightStatusId.EnRoute or FlightStatusId.IntermediateStop)
            {
                int occurrenceIndex = Math.Max(
                    departure.DepartureStatuses.Count(departureStatus => departureStatus.StatusId == (int)statusId) - 1,
                    0);
                int sequenceIndex = FindStatusIndexByOccurrence(sequence, statusId, occurrenceIndex);

                return sequenceIndex >= 0 ? sequenceIndex : sequence.Count;
            }

            return FindFirstStatusIndex(sequence, statusId);
        }

        private static int FindStatusIndexByOccurrence(
            IReadOnlyList<FlightStatusId> sequence,
            FlightStatusId statusId,
            int occurrenceIndex)
        {
            int seenCount = 0;

            for (int index = 0; index < sequence.Count; index++)
            {
                if (sequence[index] != statusId)
                    continue;

                if (seenCount == occurrenceIndex)
                    return index;

                seenCount++;
            }

            return -1;
        }

        private static int FindFirstStatusIndex(
            IReadOnlyList<FlightStatusId> sequence,
            FlightStatusId statusId)
        {
            for (int index = 0; index < sequence.Count; index++)
            {
                if (sequence[index] == statusId)
                    return index;
            }

            return -1;
        }

        private static int FindLastStatusIndex(
            IReadOnlyList<FlightStatusId> sequence,
            FlightStatusId statusId)
        {
            for (int index = sequence.Count - 1; index >= 0; index--)
            {
                if (sequence[index] == statusId)
                    return index;
            }

            return -1;
        }

        private static string BuildPersonFullName(Person person)
        {
            return BuildPersonFullName(person.LastName, person.FirstName, person.Patronymic);
        }

        private bool IsContractDocumentUploadedByAirline(Departure departure)
        {
            return departure.ContractDocumentUploadedByUserId.HasValue &&
                _context.Users.Any(user =>
                    user.Id == departure.ContractDocumentUploadedByUserId.Value &&
                    user.AirlineId == departure.Plane.AirlineId);
        }

        private async Task<bool> IsContractDocumentUploadedByAirlineAsync(
            Departure departure,
            CancellationToken cancellationToken)
        {
            return departure.ContractDocumentUploadedByUserId.HasValue &&
                await _context.Users.AnyAsync(
                    user =>
                        user.Id == departure.ContractDocumentUploadedByUserId.Value &&
                        user.AirlineId == departure.Plane.AirlineId,
                    cancellationToken);
        }

        private static string BuildPersonFullName(
            string? lastName,
            string? firstName,
            string? patronymic)
        {
            return string.Join(
                " ",
                new[]
                {
                    lastName,
                    firstName,
                    patronymic
                }.Where(namePart => !string.IsNullOrWhiteSpace(namePart)));
        }

        private static bool HasPersonFullName(Person? person)
        {
            return person != null &&
                !string.IsNullOrWhiteSpace(person.LastName) &&
                !string.IsNullOrWhiteSpace(person.FirstName);
        }

        private static bool IsRequestedTakeOffDateTimeTooEarly(DateTime requestedTakeOffDateTime)
        {
            return requestedTakeOffDateTime < DateTime.Today.AddDays(1);
        }

        private static string? GetPassengerEmail(Person person)
        {
            if (!string.IsNullOrWhiteSpace(person.Email))
                return person.Email;

            return person.Users
                .OrderBy(user => user.Id)
                .Select(user => user.Email)
                .FirstOrDefault(email => !string.IsNullOrWhiteSpace(email));
        }

        private static DateTime? CalculatePaymentDeadlineAt(
            IEnumerable<DepartureStatus> departureStatuses,
            int? paymentDeadlineDays)
        {
            if (paymentDeadlineDays is null or <= 0)
                return null;

            DateTime? awaitingPaymentSetAt = departureStatuses
                .Where(departureStatus => departureStatus.StatusId == (int)FlightStatusId.AwaitingPayment)
                .OrderByDescending(departureStatus => departureStatus.StatusSettingDateTime)
                .ThenByDescending(departureStatus => departureStatus.Id)
                .Select(departureStatus => (DateTime?)departureStatus.StatusSettingDateTime)
                .FirstOrDefault();

            return awaitingPaymentSetAt?.AddDays(paymentDeadlineDays.Value);
        }

        private static DateTime? CalculatePaymentDeadlineAtFromResponses(
            IEnumerable<ManagementDepartureStatusResponse> departureStatuses,
            int? paymentDeadlineDays)
        {
            if (paymentDeadlineDays is null or <= 0)
                return null;

            DateTime? awaitingPaymentSetAt = departureStatuses
                .Where(departureStatus => departureStatus.Id == (int)FlightStatusId.AwaitingPayment)
                .OrderByDescending(departureStatus => departureStatus.SetAt)
                .Select(departureStatus => (DateTime?)departureStatus.SetAt)
                .FirstOrDefault();

            return awaitingPaymentSetAt?.AddDays(paymentDeadlineDays.Value);
        }

        [HttpGet("{departureId:int}/ticket")]
        public async Task<IActionResult> DownloadTicket(int departureId, CancellationToken cancellationToken)
        {
            Claim? userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);

            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
                return Unauthorized();

            Departure? departure = await _context.Departures
                .Include(departure => departure.Plane)
                    .ThenInclude(plane => plane.Airline)
                .Include(departure => departure.TakeOffAirport)
                .Include(departure => departure.LandingAirport)
                .Include(departure => departure.People)
                .FirstOrDefaultAsync(
                    departure => departure.Id == departureId,
                    cancellationToken);

            if (departure == null)
                return NotFound();

            int? userAirlineId = await GetCurrentUserAirlineIdAsync(cancellationToken);
            bool isRequester = departure.CharterRequesterId == userId;
            bool isAirlineEmployee = userAirlineId is not null &&
                departure.Plane.AirlineId == userAirlineId.Value;

            if (!isRequester && !isAirlineEmployee)
                return Forbid();

            DeparturePdfData departurePdfData = _departurePdfDataFactory.Create(departure);
            byte[] pdfBytes = _ticketPdfService.Generate(departurePdfData);

            return File(pdfBytes, "application/pdf", $"ticket-{departureId}.pdf");
        }

        [HttpGet("{departureId:int}/contract")]
        public async Task<IActionResult> DownloadContract(int departureId, CancellationToken cancellationToken)
        {
            int? userId = GetCurrentUserId();

            if (userId is null)
                return Unauthorized();

            Departure? departure = await _context.Departures
                .Include(departure => departure.CharterRequester)
                    .ThenInclude(user => user.Person)
                .Include(departure => departure.Plane)
                    .ThenInclude(plane => plane.Airline)
                        .ThenInclude(airline => airline.Users)
                            .ThenInclude(user => user.Role)
                .Include(departure => departure.Plane)
                    .ThenInclude(plane => plane.Airline)
                        .ThenInclude(airline => airline.Users)
                            .ThenInclude(user => user.Person)
                .Include(departure => departure.TakeOffAirport)
                .Include(departure => departure.LandingAirport)
                .Include(departure => departure.People)
                .Include(departure => departure.DepartureStatuses)
                .Include(departure => departure.DepartureRouteLegs)
                    .ThenInclude(routeLeg => routeLeg.FromAirport)
                .Include(departure => departure.DepartureRouteLegs)
                    .ThenInclude(routeLeg => routeLeg.ToAirport)
                .FirstOrDefaultAsync(
                    departure => departure.Id == departureId,
                    cancellationToken);

            if (departure == null)
                return NotFound();

            int? userAirlineId = await GetCurrentUserAirlineIdAsync(cancellationToken);
            bool isRequester = departure.CharterRequesterId == userId.Value;
            bool isAirlineEmployee = userAirlineId is not null &&
                departure.Plane.AirlineId == userAirlineId.Value;

            if (!isRequester && !isAirlineEmployee)
                return Forbid();

            User? signingUser = departure.Plane.Airline.Users
                .FirstOrDefault(user =>
                    user.Role.Name == "GeneralDirector" &&
                    HasPersonFullName(user.Person))
                ?? departure.Plane.Airline.Users
                    .FirstOrDefault(user =>
                        user.Role.Name == "Owner" &&
                        HasPersonFullName(user.Person));

            if (signingUser == null)
                return BadRequest("Для формирования договора укажите генерального директора или владельца авиакомпании.");

            ContractPdfDataResult contractPdfDataResult = _contractPdfDataFactory.Create(
                departure,
                signingUser);

            if (contractPdfDataResult.MissingFields.Count > 0 || contractPdfDataResult.Data == null)
            {
                return BadRequest(CreateContractMissingDataMessage(contractPdfDataResult.MissingFields));
            }

            byte[] pdfBytes = _contractPdfService.Generate(contractPdfDataResult.Data);

            return File(pdfBytes, "application/pdf", $"contract-{departureId}.pdf");
        }

        [HttpPost("{departureId:int}/contract-document")]
        [RequestSizeLimit(20_000_000)]
        public async Task<IActionResult> UploadContractDocument(
            int departureId,
            IFormFile file,
            CancellationToken cancellationToken)
        {
            int? userId = GetCurrentUserId();

            if (userId is null)
                return Unauthorized();

            Departure? departure = await _context.Departures
                .Include(departure => departure.Plane)
                .Include(departure => departure.DepartureStatuses)
                .FirstOrDefaultAsync(departure => departure.Id == departureId, cancellationToken);

            if (departure is null)
                return NotFound();

            int? userAirlineId = await GetCurrentUserAirlineIdAsync(cancellationToken);
            bool isRequester = departure.CharterRequesterId == userId.Value;
            bool isAirlineEmployee = userAirlineId is not null &&
                departure.Plane.AirlineId == userAirlineId.Value;

            if (!isRequester && !isAirlineEmployee)
                return Forbid();

            DepartureStatus? currentStatus = GetCurrentStatus(departure);

            if (isRequester && currentStatus?.StatusId != (int)FlightStatusId.AwaitingContractSigning)
                return BadRequest("Договор можно загрузить только после одобрения заявки менеджером.");

            if (isAirlineEmployee && currentStatus?.StatusId != (int)FlightStatusId.AwaitingContractSigning)
                return BadRequest("Договор можно загрузить только в статусе ожидания подписания договора.");

            if (isRequester &&
                !isAirlineEmployee &&
                await IsContractDocumentUploadedByAirlineAsync(departure, cancellationToken))
                return BadRequest("Исполнитель уже загрузил подписанный договор. Новую копию загрузить нельзя.");

            if (file.Length == 0)
                return BadRequest("Файл договора пустой.");

            string contentType = string.IsNullOrWhiteSpace(file.ContentType)
                ? "application/octet-stream"
                : file.ContentType;

            await using MemoryStream memoryStream = new();
            await file.CopyToAsync(memoryStream, cancellationToken);

            departure.ContractDocument = memoryStream.ToArray();
            departure.ContractDocumentFileName = Path.GetFileName(file.FileName);
            departure.ContractDocumentContentType = contentType;
            departure.ContractDocumentUploadedAt = DateTime.UtcNow;
            departure.ContractDocumentUploadedByUserId = userId.Value;

            await _context.SaveChangesAsync(cancellationToken);

            return NoContent();
        }

        [HttpGet("{departureId:int}/contract-document")]
        public async Task<IActionResult> DownloadContractDocument(int departureId, CancellationToken cancellationToken)
        {
            int? userId = GetCurrentUserId();

            if (userId is null)
                return Unauthorized();

            Departure? departure = await _context.Departures
                .AsNoTracking()
                .Include(departure => departure.Plane)
                .FirstOrDefaultAsync(departure => departure.Id == departureId, cancellationToken);

            if (departure is null)
                return NotFound();

            int? userAirlineId = await GetCurrentUserAirlineIdAsync(cancellationToken);
            bool isRequester = departure.CharterRequesterId == userId.Value;
            bool isAirlineEmployee = userAirlineId is not null &&
                departure.Plane.AirlineId == userAirlineId.Value;

            if (!isRequester && !isAirlineEmployee)
                return Forbid();

            if (departure.ContractDocument is null || departure.ContractDocument.Length == 0)
                return NotFound("Договор ещё не загружен.");

            return File(
                departure.ContractDocument,
                departure.ContractDocumentContentType ?? "application/octet-stream",
                departure.ContractDocumentFileName ?? $"contract-document-{departureId}.pdf");
        }

        private enum ManagementDepartureSection
        {
            Orders,
            Flights,
            Completed
        }

        private sealed class ManagementDepartureRouteLegListItem
        {
            public int DepartureId { get; init; }

            public int SequenceNumber { get; init; }

            public AirportSearchResponse FromAirport { get; init; } = null!;

            public AirportSearchResponse ToAirport { get; init; } = null!;

            public RouteLegResponse Leg { get; init; } = null!;
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
            Denied = 18,
            AwaitingContractSigning = 19,
            AwaitingPayment = 20,
            IntermediateStop = 21
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
