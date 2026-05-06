using AirCharter.API.Model;
using AirCharter.API.Responses.Departures;
using AirCharter.API.Responses.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AirCharter.API.Controllers;

[ApiController]
[Route("users")]
[Authorize]
public sealed class UsersController(AirCharterExtendedContext context) : ControllerBase
{
    private readonly AirCharterExtendedContext _context = context;

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
                    .Select(departureStatus => (int?)departureStatus.StatusId)
                    .FirstOrDefault(),
                Status = departure.DepartureStatuses
                    .OrderByDescending(departureStatus => departureStatus.StatusSettingDateTime)
                    .Select(departureStatus => departureStatus.Status.Status1)
                    .FirstOrDefault() ?? string.Empty,
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
}
