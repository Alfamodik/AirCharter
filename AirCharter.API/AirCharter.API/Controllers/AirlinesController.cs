using AirCharter.API.Model;
using AirCharter.API.Requests.Airlines;
using AirCharter.API.Requests.Authentication;
using AirCharter.API.Responses.Airlines;
using AirCharter.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AirCharter.API.Controllers;

[ApiController]
[Authorize]
[Route("airlines")]
public sealed class AirlinesController(AirCharterExtendedContext context, JwtService jwtService) : ControllerBase
{
    private const string AirlineProfileRoles = "Owner,GeneralDirector";
    private const string AirlineEmployeeRoles = "Owner,Manager,Admin,GeneralDirector,Employee";

    private readonly AirCharterExtendedContext _context = context;
    private readonly JwtService _jwtService = jwtService;

    [HttpPost("register")]
    public async Task<ActionResult<AccessTokenResponse>> RegisterAirline(
        RegisterAirlineRequest request,
        CancellationToken cancellationToken)
    {
        int? userId = GetCurrentUserId();

        if (userId is null)
            return Unauthorized();

        User? user = await _context.Users
            .Include(currentUser => currentUser.Role)
            .FirstOrDefaultAsync(currentUser => currentUser.Id == userId.Value, cancellationToken);

        if (user is null)
            return Unauthorized();

        if (user.AirlineId is not null)
            return BadRequest("Пользователь уже привязан к авиакомпании.");

        int ownerRoleId = await _context.Roles
            .Where(role => role.Name == "Owner")
            .Select(role => role.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (ownerRoleId == 0)
            return BadRequest("Роль владельца авиакомпании не найдена.");

        string airlineName = NormalizeRequiredString(request.AirlineName);
        string organizationFullName = NormalizeRequiredString(request.OrganizationFullName);
        string organizationShortName = NormalizeRequiredString(request.OrganizationShortName);

        if (string.IsNullOrWhiteSpace(airlineName))
            return BadRequest("Укажите название авиакомпании.");

        if (string.IsNullOrWhiteSpace(organizationFullName))
            return BadRequest("Укажите полное наименование организации.");

        if (string.IsNullOrWhiteSpace(organizationShortName))
            return BadRequest("Укажите краткое наименование организации.");

        bool duplicateExists = await _context.Airlines.AnyAsync(airline =>
            airline.AirlineName == airlineName ||
            airline.OrganizationFullName == organizationFullName ||
            airline.OrganizationShortName == organizationShortName,
            cancellationToken);

        if (duplicateExists)
            return Conflict("Авиакомпания с таким названием или наименованием уже существует.");

        if (request.ContractValidityDays is <= 0)
            return BadRequest("Срок действия договора должен быть больше 0.");

        if (request.PaymentDeadlineDays is <= 0)
            return BadRequest("Срок оплаты должен быть больше 0.");

        if (request.PassengerArrivalMinutesBeforeFlight is <= 0)
            return BadRequest("Время прибытия пассажиров должно быть больше 0.");

        Airline airline = new()
        {
            AirlineName = airlineName,
            CreationDate = DateOnly.FromDateTime(DateTime.UtcNow),
            OrganizationFullName = organizationFullName,
            OrganizationShortName = organizationShortName,
            LegalAddress = NormalizeRequiredString(request.LegalAddress),
            PostalAddress = NormalizeRequiredString(request.PostalAddress),
            PhoneNumber = NormalizeRequiredString(request.PhoneNumber),
            Email = NormalizeRequiredString(request.Email),
            BankName = NormalizeRequiredString(request.BankName),
            TaxpayerId = NormalizeRequiredString(request.TaxpayerId),
            TaxRegistrationReasonCode = NormalizeRequiredString(request.TaxRegistrationReasonCode),
            PrimaryStateRegistrationNumber = NormalizeRequiredString(request.PrimaryStateRegistrationNumber),
            CurrentAccountNumber = NormalizeRequiredString(request.CurrentAccountNumber),
            CorrespondentAccountNumber = NormalizeRequiredString(request.CorrespondentAccountNumber),
            BankIdentifierCode = NormalizeRequiredString(request.BankIdentifierCode),
            ContractCity = NormalizeOptionalString(request.ContractCity),
            ContractValidityDays = request.ContractValidityDays,
            PaymentDeadlineDays = request.PaymentDeadlineDays,
            CateringClass = NormalizeOptionalString(request.CateringClass),
            PassengerArrivalMinutesBeforeFlight = request.PassengerArrivalMinutesBeforeFlight
        };

        string? profileValidationError = AirlineProfileCompleteness.Validate(airline);

        if (profileValidationError is not null)
            return BadRequest(profileValidationError);

        _context.Airlines.Add(airline);
        await _context.SaveChangesAsync(cancellationToken);

        user.AirlineId = airline.Id;
        user.RoleId = ownerRoleId;
        await _context.SaveChangesAsync(cancellationToken);

        string token = _jwtService.GenerateAccessToken(user.Id, "Owner");

        return Ok(new AccessTokenResponse
        {
            Token = token
        });
    }

    [HttpGet("my/employees")]
    [Authorize(Roles = AirlineEmployeeRoles)]
    public async Task<ActionResult<IEnumerable<AirlineEmployeeResponse>>> GetMyEmployees(
        [FromQuery] int? availableForDepartureId,
        CancellationToken cancellationToken)
    {
        int? airlineId = await GetCurrentUserAirlineIdAsync(cancellationToken);

        if (airlineId is null)
            return Forbid();

        DateTime? availableDepartureStart = null;
        DateTime? availableDepartureEnd = null;

        if (availableForDepartureId is not null)
        {
            var availableDeparture = await _context.Departures
                .AsNoTracking()
                .Where(
                    departure =>
                        departure.Id == availableForDepartureId.Value &&
                        departure.Plane.AirlineId == airlineId.Value)
                .Select(departure => new
                {
                    Start = departure.RequestedTakeOffDateTime,
                    departure.FlightTime
                })
                .FirstOrDefaultAsync(cancellationToken);

            if (availableDeparture is null)
                return NotFound();

            availableDepartureStart = availableDeparture.Start;
            availableDepartureEnd = availableDeparture.Start.Add(availableDeparture.FlightTime);
        }

        User[] employees = await _context.Users
            .AsNoTracking()
            .Include(user => user.Person)
            .Include(user => user.Role)
            .Include(user => user.DeparturesNavigation)
            .Where(user => user.AirlineId == airlineId.Value && user.IsActive)
            .ToArrayAsync(cancellationToken);

        if (availableForDepartureId is not null)
        {
            employees = employees
                .Where(user => !user.DeparturesNavigation.Any(departure =>
                    departure.Id != availableForDepartureId.Value &&
                    DoDepartureIntervalsOverlap(
                        availableDepartureStart!.Value,
                        availableDepartureEnd!.Value,
                        departure.RequestedTakeOffDateTime,
                        departure.RequestedTakeOffDateTime.Add(departure.FlightTime))))
                .ToArray();
        }

        AirlineEmployeeResponse[] response = employees
            .OrderBy(user => user.Person == null ? user.Email : user.Person.LastName)
            .ThenBy(user => user.Person == null ? user.Email : user.Person.FirstName)
            .Select(user => new AirlineEmployeeResponse
            {
                Id = user.Id,
                Email = user.Email,
                RoleName = user.Role.Name,
                FullName = user.Person == null
                    ? null
                    : BuildPersonFullName(
                        user.Person.LastName,
                        user.Person.FirstName,
                        user.Person.Patronymic)
            })
            .ToArray();

        return Ok(response);
    }

    [HttpGet("my/contract-settings")]
    [Authorize(Roles = AirlineProfileRoles)]
    public async Task<IActionResult> GetMyContractSettings(CancellationToken cancellationToken)
    {
        int? airlineId = await GetCurrentUserAirlineIdAsync(cancellationToken);

        if (airlineId is null)
            return Forbid();

        Airline? airline = await _context.Airlines
            .AsNoTracking()
            .Where(airline => airline.Id == airlineId.Value)
            .FirstOrDefaultAsync(cancellationToken);

        if (airline == null)
            return NotFound();

        return Ok(CreateResponse(airline));
    }

    [HttpPut("my/contract-settings")]
    [Authorize(Roles = AirlineProfileRoles)]
    public async Task<IActionResult> UpdateMyContractSettings(
        UpdateAirlineContractSettingsRequest request,
        CancellationToken cancellationToken)
    {
        int? airlineId = await GetCurrentUserAirlineIdAsync(cancellationToken);

        if (airlineId is null)
            return Forbid();

        Airline? airline = await _context.Airlines
            .FirstOrDefaultAsync(airline => airline.Id == airlineId.Value, cancellationToken);

        if (airline == null)
            return NotFound();

        if (request.ContractValidityDays is <= 0)
            return BadRequest("Срок действия договора должен быть больше 0.");

        if (request.PaymentDeadlineDays is <= 0)
            return BadRequest("Срок оплаты должен быть больше 0.");

        if (request.PassengerArrivalMinutesBeforeFlight is <= 0)
            return BadRequest("Время прибытия пассажиров должно быть больше 0.");

        airline.AirlineName = NormalizeRequiredString(request.AirlineName);
        airline.OrganizationFullName = NormalizeRequiredString(request.OrganizationFullName);
        airline.OrganizationShortName = NormalizeRequiredString(request.OrganizationShortName);
        airline.LegalAddress = NormalizeRequiredString(request.LegalAddress);
        airline.PostalAddress = NormalizeRequiredString(request.PostalAddress);
        airline.PhoneNumber = NormalizeRequiredString(request.PhoneNumber);
        airline.Email = NormalizeRequiredString(request.Email);
        airline.BankName = NormalizeRequiredString(request.BankName);
        airline.TaxpayerId = NormalizeRequiredString(request.TaxpayerId);
        airline.TaxRegistrationReasonCode = NormalizeRequiredString(request.TaxRegistrationReasonCode);
        airline.PrimaryStateRegistrationNumber = NormalizeRequiredString(request.PrimaryStateRegistrationNumber);
        airline.CurrentAccountNumber = NormalizeRequiredString(request.CurrentAccountNumber);
        airline.CorrespondentAccountNumber = NormalizeRequiredString(request.CorrespondentAccountNumber);
        airline.BankIdentifierCode = NormalizeRequiredString(request.BankIdentifierCode);
        airline.ContractCity = NormalizeOptionalString(request.ContractCity);
        airline.ContractValidityDays = request.ContractValidityDays;
        airline.PaymentDeadlineDays = request.PaymentDeadlineDays;
        airline.CateringClass = NormalizeOptionalString(request.CateringClass);
        airline.PassengerArrivalMinutesBeforeFlight = request.PassengerArrivalMinutesBeforeFlight;

        string? profileValidationError = AirlineProfileCompleteness.Validate(airline);

        if (profileValidationError is not null)
            return BadRequest(profileValidationError);

        await _context.SaveChangesAsync(cancellationToken);

        return Ok(CreateResponse(airline));
    }

    [HttpPut("my/image")]
    [Authorize(Roles = AirlineProfileRoles)]
    public async Task<IActionResult> UpdateMyImage(
        UpdateAirlineImageRequest request,
        CancellationToken cancellationToken)
    {
        int? airlineId = await GetCurrentUserAirlineIdAsync(cancellationToken);

        if (airlineId is null)
            return Forbid();

        Airline? airline = await _context.Airlines
            .FirstOrDefaultAsync(airline => airline.Id == airlineId.Value, cancellationToken);

        if (airline == null)
            return NotFound();

        if (string.IsNullOrWhiteSpace(request.ImageBase64))
        {
            airline.Image = null;
        }
        else
        {
            string imageBase64 = request.ImageBase64.Trim();
            int commaIndex = imageBase64.IndexOf(',');

            if (commaIndex >= 0)
                imageBase64 = imageBase64[(commaIndex + 1)..];

            try
            {
                airline.Image = Convert.FromBase64String(imageBase64);
            }
            catch (FormatException)
            {
                return BadRequest("Изображение должно быть передано в формате base64.");
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        return NoContent();
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

    private static AirlineContractSettingsResponse CreateResponse(Airline airline)
    {
        return new AirlineContractSettingsResponse
        {
            Id = airline.Id,
            AirlineName = airline.AirlineName,
            OrganizationFullName = airline.OrganizationFullName,
            OrganizationShortName = airline.OrganizationShortName,
            LegalAddress = airline.LegalAddress,
            PostalAddress = airline.PostalAddress,
            PhoneNumber = airline.PhoneNumber,
            Email = airline.Email,
            BankName = airline.BankName,
            TaxpayerId = airline.TaxpayerId,
            TaxRegistrationReasonCode = airline.TaxRegistrationReasonCode,
            PrimaryStateRegistrationNumber = airline.PrimaryStateRegistrationNumber,
            CurrentAccountNumber = airline.CurrentAccountNumber,
            CorrespondentAccountNumber = airline.CorrespondentAccountNumber,
            BankIdentifierCode = airline.BankIdentifierCode,
            ContractCity = airline.ContractCity,
            ContractValidityDays = airline.ContractValidityDays,
            PaymentDeadlineDays = airline.PaymentDeadlineDays,
            CateringClass = airline.CateringClass,
            PassengerArrivalMinutesBeforeFlight = airline.PassengerArrivalMinutesBeforeFlight,
            ImageBase64 = airline.Image == null ? null : Convert.ToBase64String(airline.Image)
        };
    }

    private static string? NormalizeOptionalString(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static string NormalizeRequiredString(string? value)
    {
        return value?.Trim() ?? string.Empty;
    }

    private static bool DoDepartureIntervalsOverlap(
        DateTime leftStart,
        DateTime leftEnd,
        DateTime rightStart,
        DateTime rightEnd)
    {
        return rightStart < leftEnd && leftStart < rightEnd;
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
}
