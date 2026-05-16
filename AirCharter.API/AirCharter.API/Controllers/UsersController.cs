using AirCharter.API.Model;
using AirCharter.API.Requests.Authentication;
using AirCharter.API.Requests.Users;
using AirCharter.API.Responses.Departures;
using AirCharter.API.Responses.Users;
using AirCharter.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AirCharter.API.Controllers;

[ApiController]
[Route("users")]
[Authorize]
public sealed class UsersController(AirCharterExtendedContext context, JwtService jwtService) : ControllerBase
{
    private readonly AirCharterExtendedContext _context = context;
    private readonly JwtService _jwtService = jwtService;
    private readonly PasswordHasher<User> _passwordHasher = new();

    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser(CancellationToken cancellationToken)
    {
        Claim? userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        
        if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
            return Unauthorized();

        CurrentUserResponse? currentUserResponse = await _context.Users
            .AsNoTracking()
            .Where(user => user.Id == userId)
            .Select(user => new CurrentUserResponse
            {
                Id = user.Id,
                Email = user.Email,
                IsEmailConfirmed = user.IsEmailConfirmed,
                AirlineId = user.AirlineId,
                IsActive = user.IsActive,
                Role = new CurrentUserRoleResponse
                {
                    Id = user.Role.Id,
                    Name = user.Role.Name
                },
                Person = user.Person == null
                    ? null
                    : new CurrentUserPersonResponse
                    {
                        Id = user.Person.Id,
                        FirstName = user.Person.FirstName,
                        LastName = user.Person.LastName,
                        Patronymic = user.Person.Patronymic,
                        PassportSeries = user.Person.PassportSeries,
                        PassportNumber = user.Person.PassportNumber,
                        BirthDate = user.Person.BirthDate,
                        Email = user.Person.Email
                    }
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (currentUserResponse == null)
            return NotFound();

        return Ok(currentUserResponse);
    }

    [HttpGet("me/departures")]
    public async Task<IActionResult> GetMyDepartures(CancellationToken cancellationToken)
    {
        Claim? userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);

        if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
            return Unauthorized();

        List<MyDepartureResponse> departures = await _context.Departures
            .AsNoTracking()
            .Where(departure => departure.CharterRequesterId == userId)
            .OrderByDescending(departure => departure.RequestedTakeOffDateTime)
            .Select(departure => new MyDepartureResponse
            {
                Id = departure.Id,
                ModelName = departure.Plane.ModelName,
                TakeOffAirport = departure.TakeOffAirport.Iata ?? departure.TakeOffAirport.Icao ?? departure.TakeOffAirport.Name,
                LandingAirport = departure.LandingAirport.Iata ?? departure.LandingAirport.Icao ?? departure.LandingAirport.Name,
                TakeOffDateTime = departure.RequestedTakeOffDateTime,
                CreatedAt = departure.DepartureStatuses
                    .Where(departureStatus => departureStatus.StatusId == 1)
                    .OrderBy(departureStatus => departureStatus.StatusSettingDateTime)
                    .Select(departureStatus => (DateTime?)departureStatus.StatusSettingDateTime)
                    .FirstOrDefault(),
                CurrentStatusId = departure.DepartureStatuses
                    .OrderByDescending(departureStatus => departureStatus.StatusSettingDateTime)
                    .ThenByDescending(departureStatus => departureStatus.Id)
                    .Select(departureStatus => (int?)departureStatus.StatusId)
                    .FirstOrDefault(),
                Status = departure.DepartureStatuses
                    .OrderByDescending(departureStatus => departureStatus.StatusSettingDateTime)
                    .ThenByDescending(departureStatus => departureStatus.Id)
                    .Select(departureStatus => departureStatus.Status.Status1)
                    .FirstOrDefault() ?? string.Empty,
                HasContractDocument = departure.ContractDocument != null && departure.ContractDocument.Length > 0,
                Price = departure.Price,
                FlightTime = departure.FlightTime,
                Distance = departure.Distance,
                Transfers = departure.Transfers,
                PlaneImage = departure.Plane.Image == null ? null : Convert.ToBase64String(departure.Plane.Image),
                AirlineImage = departure.Plane.Airline.Image == null ? null : Convert.ToBase64String(departure.Plane.Airline.Image)
            })
            .ToListAsync(cancellationToken);

        return Ok(departures);
    }

    [HttpGet("me/notifications")]
    public async Task<ActionResult<IEnumerable<NotificationResponse>>> GetMyNotifications(CancellationToken cancellationToken)
    {
        int? userId = GetCurrentUserId();

        if (userId is null)
            return Unauthorized();

        NotificationResponse[] notifications = await _context.Notifications
            .AsNoTracking()
            .Where(notification => notification.UserId == userId.Value)
            .OrderByDescending(notification => notification.CreatedAtUtc)
            .ThenByDescending(notification => notification.Id)
            .Select(notification => new NotificationResponse
            {
                Id = notification.Id,
                Title = notification.Title,
                Message = notification.Message,
                ActionType = notification.ActionType,
                CreatedAtUtc = notification.CreatedAtUtc,
                ReadAtUtc = notification.ReadAtUtc
            })
            .ToArrayAsync(cancellationToken);

        return Ok(notifications);
    }

    [HttpPost("me/notifications/{notificationId:int}/read")]
    public async Task<IActionResult> MarkMyNotificationAsRead(int notificationId, CancellationToken cancellationToken)
    {
        int? userId = GetCurrentUserId();

        if (userId is null)
            return Unauthorized();

        Notification? notification = await _context.Notifications
            .FirstOrDefaultAsync(currentNotification =>
                currentNotification.Id == notificationId &&
                currentNotification.UserId == userId.Value,
                cancellationToken);

        if (notification is null)
            return NotFound();

        notification.ReadAtUtc ??= DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    [HttpPost("me/notifications/read-all")]
    public async Task<IActionResult> MarkMyNotificationsAsRead(CancellationToken cancellationToken)
    {
        int? userId = GetCurrentUserId();

        if (userId is null)
            return Unauthorized();

        DateTime readAtUtc = DateTime.UtcNow;
        Notification[] unreadNotifications = await _context.Notifications
            .Where(notification =>
                notification.UserId == userId.Value &&
                notification.ReadAtUtc == null)
            .ToArrayAsync(cancellationToken);

        foreach (Notification notification in unreadNotifications)
        {
            notification.ReadAtUtc = readAtUtc;
        }

        await _context.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    [HttpPost("me/notifications/{notificationId:int}/accept-airline-employment")]
    public async Task<ActionResult<AccessTokenResponse>> AcceptAirlineEmploymentInvitation(
        int notificationId,
        CancellationToken cancellationToken)
    {
        int? userId = GetCurrentUserId();

        if (userId is null)
            return Unauthorized();

        Notification? notification = await _context.Notifications
            .FirstOrDefaultAsync(currentNotification =>
                currentNotification.Id == notificationId &&
                currentNotification.UserId == userId.Value,
                cancellationToken);

        if (notification is null)
            return NotFound();

        if (notification.ActionType != "AirlineEmploymentInvite" ||
            notification.AirlineId is null ||
            notification.RoleId is null)
            return BadRequest("Это уведомление нельзя принять.");

        User? user = await _context.Users
            .FirstOrDefaultAsync(currentUser => currentUser.Id == userId.Value, cancellationToken);

        if (user is null)
            return Unauthorized();

        if (user.AirlineId is not null)
            return BadRequest("Пользователь уже привязан к авиакомпании.");

        bool airlineExists = await _context.Airlines
            .AnyAsync(airline => airline.Id == notification.AirlineId.Value, cancellationToken);

        if (!airlineExists)
            return BadRequest("Авиакомпания не найдена.");

        string? roleName = await _context.Roles
            .Where(role => role.Id == notification.RoleId.Value)
            .Select(role => role.Name)
            .FirstOrDefaultAsync(cancellationToken);

        if (roleName is null)
            return BadRequest("Роль сотрудника не найдена.");

        user.AirlineId = notification.AirlineId.Value;
        user.RoleId = notification.RoleId.Value;
        user.IsActive = true;
        notification.ReadAtUtc ??= DateTime.UtcNow;
        notification.ActionType = null;

        _context.AirlineNotifications.Add(new AirlineNotification
        {
            AirlineId = notification.AirlineId.Value,
            Title = "Приглашение принято",
            Message = $"Пользователь {user.Email} принял приглашение и стал сотрудником авиакомпании.",
            CreatedAtUtc = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new AccessTokenResponse
        {
            Token = _jwtService.GenerateAccessToken(user.Id, roleName)
        });
    }

    [HttpPost("me/password")]
    public async Task<IActionResult> ChangePassword(
        ChangePasswordRequest request,
        CancellationToken cancellationToken)
    {
        int? userId = GetCurrentUserId();

        if (userId is null)
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.CurrentPassword))
            return BadRequest("Current password is required.");

        if (string.IsNullOrWhiteSpace(request.NewPassword))
            return BadRequest("New password is required.");

        if (request.NewPassword.Length < 6)
            return BadRequest("New password is too short.");

        User? user = await _context.Users
            .FirstOrDefaultAsync(currentUser => currentUser.Id == userId.Value, cancellationToken);

        if (user is null)
            return Unauthorized();

        PasswordVerificationResult verificationResult =
            _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.CurrentPassword);

        if (verificationResult == PasswordVerificationResult.Failed)
            return BadRequest("Current password is invalid.");

        user.PasswordHash = _passwordHasher.HashPassword(user, request.NewPassword);

        await _context.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    private int? GetCurrentUserId()
    {
        Claim? userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);

        if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
            return null;

        return userId;
    }
}
