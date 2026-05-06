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

            return Ok(CreateCurrentUserPersonResponse(user.Person));
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

            Person? existingPerson = await _context.Persons
                .Include(person => person.Users)
                .FirstOrDefaultAsync(
                    person => person.PassportSeries == passportSeries &&
                              person.PassportNumber == passportNumber,
                    cancellationToken);

            Person person = existingPerson ?? GetOrCreatePerson(user);

            ApplyPersonFields(
                person,
                firstName,
                lastName,
                patronymic,
                passportSeries,
                passportNumber,
                email,
                request.BirthDate,
                request.RegistrationAddress,
                request.ActualAddress,
                request.PhoneNumber,
                request.TaxpayerId,
                request.BankName,
                request.CurrentAccountNumber,
                request.CorrespondentAccountNumber,
                request.BankIdentifierCode);

            if (user.Person?.Id != person.Id)
            {
                user.Person = person;
                user.PersonId = person.Id == 0 ? null : person.Id;
            }

            await _context.SaveChangesAsync(cancellationToken);

            return Ok(CreateCurrentUserPersonResponse(person));
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
                .Include(person => person.Users)
                .Where(person =>
                    (person.LastName + " " + person.FirstName + " " + (person.Patronymic ?? ""))
                        .ToLower()
                        .Contains(normalizedQuery) ||
                    (person.Email != null && person.Email.ToLower().Contains(normalizedQuery)) ||
                    person.Users.Any(user => user.Email.ToLower().Contains(normalizedQuery)) ||
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

            Person? person = await _context.Persons
                .Include(person => person.Users)
                .FirstOrDefaultAsync(
                    person => person.PassportSeries == passportSeries &&
                              person.PassportNumber == passportNumber,
                    cancellationToken);

            if (person is null)
            {
                person = new Person();
                _context.Persons.Add(person);
            }

            ApplyPersonFields(
                person,
                request.FirstName.Trim(),
                request.LastName.Trim(),
                string.IsNullOrWhiteSpace(request.Patronymic) ? null : request.Patronymic.Trim(),
                passportSeries,
                passportNumber,
                string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim(),
                request.BirthDate,
                request.RegistrationAddress,
                request.ActualAddress,
                request.PhoneNumber,
                request.TaxpayerId,
                request.BankName,
                request.CurrentAccountNumber,
                request.CorrespondentAccountNumber,
                request.BankIdentifierCode);

            await _context.SaveChangesAsync(cancellationToken);

            return Ok(CreatePassengerSearchResponse(person));
        }

        [Authorize]
        [HttpPost("{personId:int}/edit-details")]
        public async Task<ActionResult<PersonEditResponse>> GetPassengerEditDetails(
            int personId,
            [FromBody] PersonPassportRequest request,
            CancellationToken cancellationToken)
        {
            string? validationError = ValidatePassportRequest(request);

            if (validationError != null)
                return BadRequest(validationError);

            string passportSeries = request.PassportSeries.Trim();
            string passportNumber = request.PassportNumber.Trim();

            Person? person = await _context.Persons
                .AsNoTracking()
                .FirstOrDefaultAsync(person => person.Id == personId, cancellationToken);

            if (person is null || !HasPassport(person, passportSeries, passportNumber))
                return NotFound("Passenger with these passport details was not found.");

            return Ok(CreatePersonEditResponse(person));
        }

        [Authorize]
        [HttpPut("{personId:int}")]
        public async Task<ActionResult<PassengerSearchResponse>> UpdatePassengerByPassport(
            int personId,
            [FromBody] UpdatePassengerByPassportRequest request,
            CancellationToken cancellationToken)
        {
            string? validationError = ValidateRequest(request);

            if (validationError != null)
                return BadRequest(validationError);

            string currentPassportSeries = request.CurrentPassportSeries.Trim();
            string currentPassportNumber = request.CurrentPassportNumber.Trim();
            string passportSeries = request.PassportSeries.Trim();
            string passportNumber = request.PassportNumber.Trim();

            Person? person = await _context.Persons
                .Include(person => person.Users)
                .FirstOrDefaultAsync(person => person.Id == personId, cancellationToken);

            if (person is null || !HasPassport(person, currentPassportSeries, currentPassportNumber))
                return NotFound("Passenger with these passport details was not found.");

            bool isPassportAlreadyUsed = await _context.Persons
                .AnyAsync(
                    existingPerson => existingPerson.Id != person.Id &&
                        existingPerson.PassportSeries == passportSeries &&
                        existingPerson.PassportNumber == passportNumber,
                    cancellationToken);

            if (isPassportAlreadyUsed)
                return Conflict("A person with the same passport details already exists.");

            ApplyPersonFields(
                person,
                request.FirstName.Trim(),
                request.LastName.Trim(),
                string.IsNullOrWhiteSpace(request.Patronymic) ? null : request.Patronymic.Trim(),
                passportSeries,
                passportNumber,
                string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim(),
                request.BirthDate,
                request.RegistrationAddress,
                request.ActualAddress,
                request.PhoneNumber,
                request.TaxpayerId,
                request.BankName,
                request.CurrentAccountNumber,
                request.CorrespondentAccountNumber,
                request.BankIdentifierCode);

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

        private static string? ValidateRequest(UpdatePassengerByPassportRequest request)
        {
            string? currentPassportValidationError = ValidatePassportFields(
                request.CurrentPassportSeries,
                request.CurrentPassportNumber);

            if (currentPassportValidationError != null)
                return currentPassportValidationError;

            return ValidatePersonFields(
                request.FirstName,
                request.LastName,
                request.PassportSeries,
                request.PassportNumber);
        }

        private static string? ValidatePassportRequest(PersonPassportRequest request)
        {
            return ValidatePassportFields(request.PassportSeries, request.PassportNumber);
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

            return ValidatePassportFields(passportSeriesValue, passportNumberValue);
        }

        private static string? ValidatePassportFields(
            string? passportSeriesValue,
            string? passportNumberValue)
        {
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
                Email = GetPassengerEmail(person)
            };
        }

        private static PersonEditResponse CreatePersonEditResponse(Person person)
        {
            return new PersonEditResponse
            {
                Id = person.Id,
                FirstName = person.FirstName,
                LastName = person.LastName,
                Patronymic = person.Patronymic,
                PassportSeries = person.PassportSeries,
                PassportNumber = person.PassportNumber,
                Email = person.Email,
                BirthDate = person.BirthDate,
                RegistrationAddress = person.RegistrationAddress,
                ActualAddress = person.ActualAddress,
                PhoneNumber = person.PhoneNumber,
                TaxpayerId = person.TaxpayerId,
                BankName = person.BankName,
                CurrentAccountNumber = person.CurrentAccountNumber,
                CorrespondentAccountNumber = person.CorrespondentAccountNumber,
                BankIdentifierCode = person.BankIdentifierCode
            };
        }

        private static CurrentUserPersonResponse CreateCurrentUserPersonResponse(Person person)
        {
            return new CurrentUserPersonResponse
            {
                Id = person.Id,
                FirstName = person.FirstName,
                LastName = person.LastName,
                Patronymic = person.Patronymic,
                PassportSeries = person.PassportSeries,
                PassportNumber = person.PassportNumber,
                Email = person.Email,
                BirthDate = person.BirthDate,
                RegistrationAddress = person.RegistrationAddress,
                ActualAddress = person.ActualAddress,
                PhoneNumber = person.PhoneNumber,
                TaxpayerId = person.TaxpayerId,
                BankName = person.BankName,
                CurrentAccountNumber = person.CurrentAccountNumber,
                CorrespondentAccountNumber = person.CorrespondentAccountNumber,
                BankIdentifierCode = person.BankIdentifierCode
            };
        }

        private static void ApplyPersonFields(
            Person person,
            string firstName,
            string lastName,
            string? patronymic,
            string passportSeries,
            string passportNumber,
            string? email,
            DateOnly? birthDate,
            string? registrationAddress,
            string? actualAddress,
            string? phoneNumber,
            string? taxpayerId,
            string? bankName,
            string? currentAccountNumber,
            string? correspondentAccountNumber,
            string? bankIdentifierCode)
        {
            person.FirstName = firstName;
            person.LastName = lastName;
            person.Patronymic = patronymic;
            person.PassportSeries = passportSeries;
            person.PassportNumber = passportNumber;
            person.Email = email;
            person.BirthDate = birthDate;
            person.RegistrationAddress = NormalizeOptionalString(registrationAddress);
            person.ActualAddress = NormalizeOptionalString(actualAddress);
            person.PhoneNumber = NormalizeOptionalString(phoneNumber);
            person.TaxpayerId = NormalizeOptionalString(taxpayerId);
            person.BankName = NormalizeOptionalString(bankName);
            person.CurrentAccountNumber = NormalizeOptionalString(currentAccountNumber);
            person.CorrespondentAccountNumber = NormalizeOptionalString(correspondentAccountNumber);
            person.BankIdentifierCode = NormalizeOptionalString(bankIdentifierCode);
        }

        private static string? NormalizeOptionalString(string? value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
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

        private static bool HasPassport(Person person, string passportSeries, string passportNumber)
        {
            return person.PassportSeries == passportSeries &&
                person.PassportNumber == passportNumber;
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
