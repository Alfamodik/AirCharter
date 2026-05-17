using AirCharter.API.Model;
using AirCharter.API.Requests.Airlines;
using AirCharter.API.Requests.Authentication;
using AirCharter.API.Responses.Airlines;
using AirCharter.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Security.Claims;
using System.Text;

namespace AirCharter.API.Controllers;

[ApiController]
[Authorize]
[Route("airlines")]
public sealed class AirlinesController(AirCharterExtendedContext context, JwtService jwtService, EmailService emailService) : ControllerBase
{
    private const string AirlineProfileRoles = "Owner,GeneralDirector";
    private const string AirlineEmployeeManagementRoles = "Owner,Manager,Admin,GeneralDirector";
    private const string AirlineNotificationRoles = "Owner,Manager,Admin,GeneralDirector,Employee";
    private const string AirlineStaffAdministrationRoles = "Owner,Admin,GeneralDirector";

    private readonly AirCharterExtendedContext _context = context;
    private readonly JwtService _jwtService = jwtService;
    private readonly EmailService _emailService = emailService;
    private readonly PasswordHasher<User> _passwordHasher = new();

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
        string organizationType = NormalizeRequiredString(request.OrganizationType);

        if (string.IsNullOrWhiteSpace(airlineName))
            return BadRequest("Укажите название авиакомпании.");

        if (!AirlineOrganizationTypes.TryGet(organizationType, out AirlineOrganizationTypeInfo organizationTypeInfo))
            return BadRequest("Укажите тип организации.");

        bool duplicateExists = await _context.Airlines.AnyAsync(airline =>
            airline.AirlineName == airlineName,
            cancellationToken);

        if (duplicateExists)
            return Conflict("Авиакомпания с таким названием или наименованием уже существует.");

        if (request.ContractValidityDays is <= 0)
            return BadRequest("Срок действия договора должен быть больше 0.");

        if (request.PaymentDeadlineDays is <= 0)
            return BadRequest("Срок оплаты должен быть больше 0.");

        if (request.PassengerArrivalMinutesBeforeFlight is <= 0)
            return BadRequest("Время прибытия пассажиров должно быть больше 0.");

        if (request.ServiceBaseCost is <= 0)
            return BadRequest("Базовая стоимость обслуживания должна быть больше 0.");

        if (request.TransferBaseCost is <= 0)
            return BadRequest("Базовая стоимость пересадки должна быть больше 0.");

        Airline airline = new()
        {
            AirlineName = airlineName,
            CreationDate = DateOnly.FromDateTime(DateTime.UtcNow),
            IsCatalogVisible = true,
            OrganizationType = organizationTypeInfo.Type.ToString(),
            LegalAddress = NormalizeRequiredString(request.LegalAddress),
            PostalAddress = NormalizeRequiredString(request.PostalAddress),
            PhoneNumber = NormalizeRequiredString(request.PhoneNumber),
            Email = NormalizeRequiredString(request.Email),
            ServiceBaseCost = request.ServiceBaseCost ?? 0,
            TransferBaseCost = request.TransferBaseCost ?? 0,
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
    [Authorize(Roles = AirlineEmployeeManagementRoles)]
    public async Task<ActionResult<IEnumerable<AirlineEmployeeResponse>>> GetMyEmployees(
        [FromQuery] int? availableForDepartureId,
        [FromQuery] bool includeInactive,
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
            .Where(user => user.AirlineId == airlineId.Value && (includeInactive || user.IsActive))
            .ToArrayAsync(cancellationToken);

        if (availableForDepartureId is not null)
        {
            employees = employees
                .Where(user => user.IsEmailConfirmed)
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
                IsEmailConfirmed = user.IsEmailConfirmed,
                IsActive = user.IsActive,
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

    [HttpPost("my/employees")]
    [Authorize(Roles = AirlineStaffAdministrationRoles)]
    public async Task<ActionResult<CreateAirlineEmployeeResponse>> CreateMyEmployee(
        CreateAirlineEmployeeRequest request,
        CancellationToken cancellationToken)
    {
        User? currentUser = await GetCurrentUserWithRoleAsync(cancellationToken);

        if (currentUser?.AirlineId is null)
            return Forbid();

        string email = NormalizeRequiredString(request.Email).ToLowerInvariant();
        string roleName = NormalizeRequiredString(request.RoleName);

        if (string.IsNullOrWhiteSpace(email))
            return BadRequest("Укажите email сотрудника.");

        Role? targetRole = await _context.Roles
            .FirstOrDefaultAsync(role => role.Name == roleName, cancellationToken);

        if (targetRole is null || !CanAssignRole(currentUser.Role.Name, targetRole.Name))
            return BadRequest("Недоступный статус сотрудника.");

        User? existingUser = await _context.Users
            .Include(user => user.Role)
            .Include(user => user.Person)
            .FirstOrDefaultAsync(user => user.Email == email, cancellationToken);

        if (existingUser is not null)
        {
            await CreateEmploymentNotificationAsync(
                existingUser.Id,
                currentUser.AirlineId.Value,
                targetRole.Id,
                cancellationToken);

            await _context.SaveChangesAsync(cancellationToken);

            return Ok(new CreateAirlineEmployeeResponse
            {
                NotificationCreated = true,
                Message = "Пользователь уже зарегистрирован в AirCharter. Мы отправили ему приглашение в авиакомпанию."
            });
        }

        string password = GenerateTemporaryPassword();
        User employee = new()
        {
            AirlineId = currentUser.AirlineId.Value,
            Email = email,
            RoleId = targetRole.Id,
            IsActive = true,
            IsEmailConfirmed = false
        };
        employee.PasswordHash = _passwordHasher.HashPassword(employee, password);

        _context.Users.Add(employee);
        await _context.SaveChangesAsync(cancellationToken);
        CreateAirlineNotification(
            currentUser.AirlineId.Value,
            "Сотрудник зарегистрирован",
            $"Создан рабочий аккаунт {employee.Email} с должностью {GetRoleDisplayName(targetRole.Name)}.");
        await _context.SaveChangesAsync(cancellationToken);

        string airlineName = await _context.Airlines
            .Where(airline => airline.Id == currentUser.AirlineId.Value)
            .Select(airline => airline.AirlineName)
            .FirstOrDefaultAsync(cancellationToken) ?? "AirCharter";

        await _emailService.SendHtmlMessageAsync(
            employee.Email,
            "Рабочий аккаунт AirCharter",
            $"""
            <h3>Для вас создан рабочий аккаунт</h3>
            <p>Авиакомпания: <b>{System.Net.WebUtility.HtmlEncode(airlineName)}</b></p>
            <p>Логин: <b>{System.Net.WebUtility.HtmlEncode(employee.Email)}</b></p>
            <p>Временный пароль: <b>{System.Net.WebUtility.HtmlEncode(password)}</b></p>
            <p>Аккаунт пока не подтвержден. При первом входе AirCharter отправит код подтверждения на эту почту.</p>
            """,
            cancellationToken);

        return Ok(new CreateAirlineEmployeeResponse
        {
            Employee = ToEmployeeResponse(employee, targetRole.Name),
            Message = "Рабочий аккаунт создан, логин и пароль отправлены на почту."
        });
    }

    [HttpPut("my/employees/{employeeId:int}/role")]
    [Authorize(Roles = AirlineStaffAdministrationRoles)]
    public async Task<ActionResult<AirlineEmployeeResponse>> UpdateMyEmployeeRole(
        int employeeId,
        UpdateAirlineEmployeeRoleRequest request,
        CancellationToken cancellationToken)
    {
        User? currentUser = await GetCurrentUserWithRoleAsync(cancellationToken);

        if (currentUser?.AirlineId is null)
            return Forbid();

        User? employee = await _context.Users
            .Include(user => user.Role)
            .Include(user => user.Person)
            .FirstOrDefaultAsync(user =>
                user.Id == employeeId &&
                user.AirlineId == currentUser.AirlineId.Value,
                cancellationToken);

        if (employee is null)
            return NotFound();

        if (!CanManageEmployee(currentUser.Role.Name, employee.Role.Name))
            return Forbid();

        string roleName = NormalizeRequiredString(request.RoleName);
        Role? targetRole = await _context.Roles
            .FirstOrDefaultAsync(role => role.Name == roleName, cancellationToken);

        if (targetRole is null || !CanAssignRole(currentUser.Role.Name, targetRole.Name))
            return BadRequest("Недоступный статус сотрудника.");

        string previousRoleName = employee.Role.Name;

        if (previousRoleName == targetRole.Name)
            return Ok(ToEmployeeResponse(employee, previousRoleName));

        employee.RoleId = targetRole.Id;
        await CreateEmployeeRoleChangedNotificationAsync(
            employee.Id,
            currentUser.AirlineId.Value,
            previousRoleName,
            targetRole.Name,
            cancellationToken);
        CreateAirlineNotification(
            currentUser.AirlineId.Value,
            "Должность сотрудника изменена",
            $"Сотруднику {employee.Email} изменили должность: {GetRoleDisplayName(previousRoleName)} -> {GetRoleDisplayName(targetRole.Name)}.");
        await _context.SaveChangesAsync(cancellationToken);

        employee.Role = targetRole;

        return Ok(ToEmployeeResponse(employee, targetRole.Name));
    }

    [HttpDelete("my/employees/{employeeId:int}")]
    [Authorize(Roles = AirlineStaffAdministrationRoles)]
    public async Task<IActionResult> DismissMyEmployee(int employeeId, CancellationToken cancellationToken)
    {
        User? currentUser = await GetCurrentUserWithRoleAsync(cancellationToken);

        if (currentUser?.AirlineId is null)
            return Forbid();

        User? employee = await _context.Users
            .Include(user => user.Role)
            .FirstOrDefaultAsync(user =>
                user.Id == employeeId &&
                user.AirlineId == currentUser.AirlineId.Value,
                cancellationToken);

        if (employee is null)
            return NotFound();

        if (!CanManageEmployee(currentUser.Role.Name, employee.Role.Name))
            return Forbid();

        int clientRoleId = await _context.Roles
            .Where(role => role.Name == "Client")
            .Select(role => role.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (clientRoleId == 0)
            return BadRequest("Роль клиента не найдена.");

        employee.AirlineId = null;
        employee.RoleId = clientRoleId;
        CreateAirlineNotification(
            currentUser.AirlineId.Value,
            "Сотрудник уволен",
            $"Сотрудник {employee.Email} был уволен.");

        await _context.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    [HttpGet("my/notifications")]
    [Authorize(Roles = AirlineNotificationRoles)]
    public async Task<ActionResult<IEnumerable<AirlineNotificationResponse>>> GetMyAirlineNotifications(
        CancellationToken cancellationToken)
    {
        int? airlineId = await GetCurrentUserAirlineIdAsync(cancellationToken);

        if (airlineId is null)
            return Forbid();

        AirlineNotificationResponse[] notifications = await _context.AirlineNotifications
            .AsNoTracking()
            .Where(notification => notification.AirlineId == airlineId.Value)
            .OrderByDescending(notification => notification.CreatedAtUtc)
            .ThenByDescending(notification => notification.Id)
            .Select(notification => new AirlineNotificationResponse
            {
                Id = notification.Id,
                Title = notification.Title,
                Message = notification.Message,
                CreatedAtUtc = notification.CreatedAtUtc,
                ReadAtUtc = notification.ReadAtUtc
            })
            .ToArrayAsync(cancellationToken);

        return Ok(notifications);
    }

    [HttpDelete("my/employment")]
    [Authorize(Roles = "Manager,Admin,GeneralDirector,Employee")]
    public async Task<IActionResult> ResignFromMyAirline(CancellationToken cancellationToken)
    {
        User? currentUser = await GetCurrentUserWithRoleAsync(cancellationToken);

        if (currentUser?.AirlineId is null)
            return Forbid();

        if (currentUser.Role.Name == "Owner")
            return BadRequest("Владелец не может уволиться из собственной авиакомпании.");

        int airlineId = currentUser.AirlineId.Value;
        int clientRoleId = await _context.Roles
            .Where(role => role.Name == "Client")
            .Select(role => role.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (clientRoleId == 0)
            return BadRequest("Роль клиента не найдена.");

        CreateAirlineNotification(
            airlineId,
            "Сотрудник уволился",
            $"Сотрудник {currentUser.Email} покинул авиакомпанию.");

        currentUser.AirlineId = null;
        currentUser.RoleId = clientRoleId;

        await _context.SaveChangesAsync(cancellationToken);

        return NoContent();
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

        bool hasDepartures = await HasAirlineDeparturesAsync(airline.Id, cancellationToken);

        return Ok(CreateResponse(airline, hasDepartures));
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

        if (request.ServiceBaseCost is <= 0)
            return BadRequest("Базовая стоимость обслуживания должна быть больше 0.");

        if (request.TransferBaseCost is <= 0)
            return BadRequest("Базовая стоимость пересадки должна быть больше 0.");

        if (!AirlineOrganizationTypes.TryGet(request.OrganizationType, out AirlineOrganizationTypeInfo organizationTypeInfo))
            return BadRequest("Укажите тип организации.");

        airline.AirlineName = NormalizeRequiredString(request.AirlineName);
        airline.OrganizationType = organizationTypeInfo.Type.ToString();
        airline.LegalAddress = NormalizeRequiredString(request.LegalAddress);
        airline.PostalAddress = NormalizeRequiredString(request.PostalAddress);
        airline.PhoneNumber = NormalizeRequiredString(request.PhoneNumber);
        airline.Email = NormalizeRequiredString(request.Email);
        airline.ServiceBaseCost = request.ServiceBaseCost ?? 0;
        airline.TransferBaseCost = request.TransferBaseCost ?? 0;
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

        bool hasDepartures = await HasAirlineDeparturesAsync(airline.Id, cancellationToken);

        return Ok(CreateResponse(airline, hasDepartures));
    }

    [HttpDelete("my")]
    [Authorize(Roles = "Owner")]
    public async Task<IActionResult> DeleteMyAirline(CancellationToken cancellationToken)
    {
        int? airlineId = await GetCurrentUserAirlineIdAsync(cancellationToken);

        if (airlineId is null)
            return Forbid();

        if (await HasAirlineDeparturesAsync(airlineId.Value, cancellationToken))
            return BadRequest("Авиакомпанию можно удалить только если по её самолётам ещё нет вылетов.");

        Airline? airline = await _context.Airlines
            .Include(airline => airline.Planes)
            .Include(airline => airline.Users)
            .FirstOrDefaultAsync(airline => airline.Id == airlineId.Value, cancellationToken);

        if (airline is null)
            return NotFound();

        int clientRoleId = await _context.Roles
            .Where(role => role.Name == "Client")
            .Select(role => role.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (clientRoleId == 0)
            return BadRequest("Роль клиента не найдена.");

        foreach (User user in airline.Users)
        {
            user.AirlineId = null;
            user.RoleId = clientRoleId;
        }

        _context.Planes.RemoveRange(airline.Planes);
        _context.Airlines.Remove(airline);

        await _context.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    [HttpPut("my/catalog-visibility")]
    [Authorize(Roles = "Owner")]
    public async Task<ActionResult<AirlineContractSettingsResponse>> UpdateMyCatalogVisibility(
        [FromBody] UpdateAirlineCatalogVisibilityRequest request,
        CancellationToken cancellationToken)
    {
        int? airlineId = await GetCurrentUserAirlineIdAsync(cancellationToken);

        if (airlineId is null)
            return Forbid();

        Airline? airline = await _context.Airlines
            .FirstOrDefaultAsync(airline => airline.Id == airlineId.Value, cancellationToken);

        if (airline is null)
            return NotFound();

        airline.IsCatalogVisible = request.IsCatalogVisible;
        await _context.SaveChangesAsync(cancellationToken);

        bool hasDepartures = await HasAirlineDeparturesAsync(airline.Id, cancellationToken);

        return Ok(CreateResponse(airline, hasDepartures));
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
                byte[] imageBytes = Convert.FromBase64String(imageBase64);

                if (!ImageAspectRatioValidator.HasAspectRatio(imageBytes, 1, 1))
                    return BadRequest("Изображение авиакомпании должно быть квадратным (1:1).");

                airline.Image = imageBytes;
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

    private async Task<User?> GetCurrentUserWithRoleAsync(CancellationToken cancellationToken)
    {
        int? userId = GetCurrentUserId();

        if (userId is null)
            return null;

        return await _context.Users
            .Include(user => user.Role)
            .FirstOrDefaultAsync(user => user.Id == userId.Value, cancellationToken);
    }

    private async Task CreateEmploymentNotificationAsync(
        int userId,
        int airlineId,
        int roleId,
        CancellationToken cancellationToken)
    {
        string airlineName = await _context.Airlines
            .Where(airline => airline.Id == airlineId)
            .Select(airline => airline.AirlineName)
            .FirstOrDefaultAsync(cancellationToken) ?? "авиакомпания";

        _context.Notifications.Add(new Notification
        {
            UserId = userId,
            Title = "Приглашение в авиакомпанию",
            Message = $"Авиакомпания «{airlineName}» приглашает вас в свою команду.",
            ActionType = "AirlineEmploymentInvite",
            AirlineId = airlineId,
            RoleId = roleId,
            CreatedAtUtc = DateTime.UtcNow
        });
    }

    private async Task CreateEmployeeRoleChangedNotificationAsync(
        int userId,
        int airlineId,
        string previousRoleName,
        string nextRoleName,
        CancellationToken cancellationToken)
    {
        string airlineName = await _context.Airlines
            .Where(airline => airline.Id == airlineId)
            .Select(airline => airline.AirlineName)
            .FirstOrDefaultAsync(cancellationToken) ?? "авиакомпания";

        _context.Notifications.Add(new Notification
        {
            UserId = userId,
            Title = "Должность изменена",
            Message = $"Авиакомпания «{airlineName}» изменила вашу должность: {GetRoleDisplayName(previousRoleName)} -> {GetRoleDisplayName(nextRoleName)}.",
            CreatedAtUtc = DateTime.UtcNow
        });
    }

    private void CreateAirlineNotification(int airlineId, string title, string message)
    {
        _context.AirlineNotifications.Add(new AirlineNotification
        {
            AirlineId = airlineId,
            Title = title,
            Message = message,
            CreatedAtUtc = DateTime.UtcNow
        });
    }

    private static string GetRoleDisplayName(string roleName)
    {
        return roleName switch
        {
            "Employee" => "Сотрудник",
            "Manager" => "Менеджер",
            "Admin" => "Администратор",
            "GeneralDirector" => "Генеральный директор",
            "Owner" => "Владелец",
            _ => roleName
        };
    }

    private async Task<bool> HasAirlineDeparturesAsync(int airlineId, CancellationToken cancellationToken)
    {
        return await _context.Departures
            .AsNoTracking()
            .AnyAsync(departure => departure.Plane.AirlineId == airlineId, cancellationToken);
    }

    private static AirlineContractSettingsResponse CreateResponse(Airline airline, bool hasDepartures)
    {
        return new AirlineContractSettingsResponse
        {
            Id = airline.Id,
            AirlineName = airline.AirlineName,
            OrganizationType = AirlineOrganizationTypes.Resolve(airline)?.Code ?? string.Empty,
            LegalAddress = airline.LegalAddress,
            PostalAddress = airline.PostalAddress,
            PhoneNumber = airline.PhoneNumber,
            Email = airline.Email,
            ServiceBaseCost = airline.ServiceBaseCost,
            TransferBaseCost = airline.TransferBaseCost,
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
            IsCatalogVisible = airline.IsCatalogVisible,
            HasDepartures = hasDepartures,
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

    private static AirlineEmployeeResponse ToEmployeeResponse(User user, string roleName)
    {
        return new AirlineEmployeeResponse
        {
            Id = user.Id,
            Email = user.Email,
            RoleName = roleName,
            IsEmailConfirmed = user.IsEmailConfirmed,
            IsActive = user.IsActive,
            FullName = user.Person == null
                ? null
                : BuildPersonFullName(
                    user.Person.LastName,
                    user.Person.FirstName,
                    user.Person.Patronymic)
        };
    }

    private static bool CanManageEmployee(string currentRoleName, string employeeRoleName)
    {
        int currentRank = GetRoleRank(currentRoleName);
        int employeeRank = GetRoleRank(employeeRoleName);

        return currentRank > employeeRank && employeeRoleName != "Owner";
    }

    private static bool CanAssignRole(string currentRoleName, string targetRoleName)
    {
        int currentRank = GetRoleRank(currentRoleName);
        int targetRank = GetRoleRank(targetRoleName);

        return targetRoleName != "Client" &&
            targetRoleName != "Owner" &&
            targetRank > 0 &&
            currentRank > targetRank;
    }

    private static int GetRoleRank(string roleName)
    {
        return roleName switch
        {
            "Employee" => 1,
            "Manager" => 2,
            "Admin" => 3,
            "GeneralDirector" => 4,
            "Owner" => 5,
            _ => 0
        };
    }

    private static string GenerateTemporaryPassword()
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%";
        byte[] bytes = RandomNumberGenerator.GetBytes(14);
        StringBuilder passwordBuilder = new(bytes.Length);

        foreach (byte value in bytes)
        {
            passwordBuilder.Append(alphabet[value % alphabet.Length]);
        }

        return passwordBuilder.ToString();
    }

    private string SetEmailConfirmationCode(User user)
    {
        string confirmationCode = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();

        user.EmailConfirmationCodeHash = _passwordHasher.HashPassword(user, confirmationCode);
        user.EmailConfirmationCodeExpiresAtUtc = DateTime.UtcNow.AddMinutes(10);

        return confirmationCode;
    }
}
