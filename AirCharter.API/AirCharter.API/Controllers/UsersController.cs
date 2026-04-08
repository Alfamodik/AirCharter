using AirCharter.API.Model;
using AirCharter.API.Responses;
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
    public async Task<IActionResult> GetCurrentUser()
    {
        Claim? userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        
        if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
            return Unauthorized();

        User? user = await _context.Users
            .Include(u => u.Role)
            .Include(u => u.Person)
            .FirstOrDefaultAsync(u => u.Id == userId);

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
}