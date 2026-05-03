using System.Security.Claims;
using AirCharter.API.Model;
using AirCharter.API.Requests.Persons;
using AirCharter.API.Responses.Persons;
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

        [Authorize]
        [HttpGet("search")]
        public async Task<ActionResult<IEnumerable<PassengerSearchResponse>>> SearchPassengers(
            [FromQuery] string query,
            [FromQuery] int limit = 8,
            CancellationToken cancellationToken = default)
        {
            string normalizedQuery = query.Trim().ToLowerInvariant();
            string digitQuery = new string(query.Where(char.IsDigit).ToArray());

            if (normalizedQuery.Length < 2 && digitQuery.Length < 2)
                return Ok(Array.Empty<PassengerSearchResponse>());

            int searchLimit = Math.Clamp(limit, 1, 20);

            List<Person> people = await _context.Persons
                .AsNoTracking()
                .Where(person =>
                    (person.LastName + " " + person.FirstName + " " + (person.Patronymic ?? ""))
                        .ToLower()
                        .Contains(normalizedQuery) ||
                    (person.Email != null && person.Email.ToLower().Contains(normalizedQuery)) ||
                    (digitQuery.Length >= 2 &&
                        (person.PassportSeries + person.PassportNumber).Contains(digitQuery)))
                .OrderBy(person => person.LastName)
                .ThenBy(person => person.FirstName)
                .Take(searchLimit)
                .ToListAsync(cancellationToken);

            return Ok(people.Select(CreatePassengerSearchResponse).ToArray());
        }

        [Authorize]
        [HttpPost]
        public async Task<ActionResult<PassengerSearchResponse>> CreatePerson(
            [FromBody] CreatePersonRequest request,
            CancellationToken cancellationToken)
        {
            string? validationError = ValidateRequest(request);

            if (validationError != null)
                return BadRequest(validationError);

            string passportSeries = request.PassportSeries.Trim();
            string passportNumber = request.PassportNumber.Trim();

            bool isPassportAlreadyUsed = await _context.Persons
                .AnyAsync(
                    person => person.PassportSeries == passportSeries &&
                              person.PassportNumber == passportNumber,
                    cancellationToken);

            if (isPassportAlreadyUsed)
                return Conflict("A person with the same passport details already exists.");

            Person person = new Person
            {
                FirstName = request.FirstName.Trim(),
                LastName = request.LastName.Trim(),
                Patronymic = string.IsNullOrWhiteSpace(request.Patronymic)
                    ? null
                    : request.Patronymic.Trim(),
                PassportSeries = passportSeries,
                PassportNumber = passportNumber,
                Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim(),
                BirthDate = request.BirthDate
            };

            _context.Persons.Add(person);
            await _context.SaveChangesAsync(cancellationToken);

            return Ok(CreatePassengerSearchResponse(person));
        }

        private static string? ValidateRequest(UpdatePersonRequest request)
        {
            return ValidatePersonFields(
                request.FirstName,
                request.LastName,
                request.PassportSeries,
                request.PassportNumber);
        }

        private static string? ValidateRequest(CreatePersonRequest request)
        {
            return ValidatePersonFields(
                request.FirstName,
                request.LastName,
                request.PassportSeries,
                request.PassportNumber);
        }

        private static string? ValidatePersonFields(
            string? firstName,
            string? lastName,
            string? passportSeriesValue,
            string? passportNumberValue)
        {
            if (string.IsNullOrWhiteSpace(firstName))
                return "First name is required.";

            if (string.IsNullOrWhiteSpace(lastName))
                return "Last name is required.";

            if (string.IsNullOrWhiteSpace(passportSeriesValue))
                return "Passport series is required.";

            if (string.IsNullOrWhiteSpace(passportNumberValue))
                return "Passport number is required.";

            string passportSeries = passportSeriesValue.Trim();
            string passportNumber = passportNumberValue.Trim();

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

        private static PassengerSearchResponse CreatePassengerSearchResponse(Person person)
        {
            return new PassengerSearchResponse
            {
                Id = person.Id,
                FullName = BuildPersonFullName(person),
                Email = person.Email
            };
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
                }.Where(part => !string.IsNullOrWhiteSpace(part)));
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
