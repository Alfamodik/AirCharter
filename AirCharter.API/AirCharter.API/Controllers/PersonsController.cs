using System.Security.Claims;
using AirCharter.API.Model;
using AirCharter.API.Requests.Persons;
using AirCharter.API.Responses.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AirCharter.API.Controllers
{
    [ApiController]
    [Route("persons")]
    public class PersonsController(AirCharterExtendedContext context) : ControllerBase
    {
        private readonly AirCharterExtendedContext _context = context;

        [Authorize]
        [HttpGet("me")]
        public async Task<IActionResult> GetMyPerson(CancellationToken cancellationToken)
        {
            Claim? userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);

            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
                return Unauthorized();

            User? user = await _context.Users
                .Include(user => user.Person)
                .FirstOrDefaultAsync(user => user.Id == userId, cancellationToken);

            if (user == null)
                return Unauthorized();

            if (user.Person == null)
                return NotFound("Person data was not found for the current user.");

            CurrentUserPersonResponse person = new()
            {
                Id = user.Person.Id,
                FirstName = user.Person.FirstName,
                LastName = user.Person.LastName,
                Patronymic = user.Person.Patronymic,
                PassportSeries = user.Person.PassportSeries,
                PassportNumber = user.Person.PassportNumber,
                Email = user.Person.Email,
                BirthDate = user.Person.BirthDate
            };

            return Ok(person);
        }

        [Authorize]
        [HttpPut("me")]
        public async Task<IActionResult> UpdateMyPerson([FromBody] UpdatePersonRequest request, CancellationToken cancellationToken)
        {
            Claim? userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);

            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
                return Unauthorized();

            User? user = await _context.Users
                .Include(user => user.Person)
                .FirstOrDefaultAsync(user => user.Id == userId, cancellationToken);

            if (user == null)
                return Unauthorized();

            string? validationError = ValidateRequest(request);

            if (validationError != null)
                return BadRequest(validationError);

            string firstName = request.FirstName.Trim();
            string lastName = request.LastName.Trim();
            string? patronymic = string.IsNullOrWhiteSpace(request.Patronymic) ? null : request.Patronymic.Trim();
            string passportSeries = request.PassportSeries.Trim();
            string passportNumber = request.PassportNumber.Trim();
            string? email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();

            int currentPersonId = user.Person?.Id ?? 0;

            bool isPassportAlreadyUsed = await _context.Persons
                .AnyAsync(
                    person => person.Id != currentPersonId
                           && person.PassportSeries == passportSeries
                           && person.PassportNumber == passportNumber,
                    cancellationToken);

            if (isPassportAlreadyUsed)
                return Conflict("A person with the same passport details already exists.");

            Person person = GetOrCreatePerson(user);

            person.FirstName = firstName;
            person.LastName = lastName;
            person.Patronymic = patronymic;
            person.PassportSeries = passportSeries;
            person.PassportNumber = passportNumber;
            person.Email = email;
            person.BirthDate = request.BirthDate;

            await _context.SaveChangesAsync(cancellationToken);

            return Ok(person);
        }

        private static string? ValidateRequest(UpdatePersonRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.FirstName))
                return "First name is required.";

            if (string.IsNullOrWhiteSpace(request.LastName))
                return "Last name is required.";

            if (string.IsNullOrWhiteSpace(request.PassportSeries))
                return "Passport series is required.";

            if (string.IsNullOrWhiteSpace(request.PassportNumber))
                return "Passport number is required.";

            string passportSeries = request.PassportSeries.Trim();
            string passportNumber = request.PassportNumber.Trim();

            if (!passportSeries.All(char.IsDigit))
                return "Passport series must contain digits only.";

            if (!passportNumber.All(char.IsDigit))
                return "Passport number must contain digits only.";

            if (passportSeries.Length != 4)
                return "Passport series must contain 4 digits.";

            if (passportNumber.Length != 6)
                return "Passport number must contain 6 digits.";

            return null;
        }

        private static Person GetOrCreatePerson(User user)
        {
            if (user.Person != null)
                return user.Person;

            Person person = new Person();
            user.Person = person;

            return person;
        }
    }
}