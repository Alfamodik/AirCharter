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

        User? user = await _context.Users
            .Include(u => u.Role)
            .Include(u => u.Person)
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null)
            return NotFound();

        CurrentUserResponse currentUserResponse = new()
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
            }
        };

        if (user.Person != null)
        {
            currentUserResponse.Person = new CurrentUserPersonResponse
            {
                Id = user.Person.Id,
                FirstName = user.Person.FirstName,
                LastName = user.Person.LastName,
                Patronymic = user.Person.Patronymic,
                BirthDate = user.Person.BirthDate,
                Email = user.Person.Email
            };
        }

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
