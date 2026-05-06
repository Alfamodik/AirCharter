using AirCharter.API.Model;
using AirCharter.API.Requests.Airlines;
using AirCharter.API.Responses.Airlines;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AirCharter.API.Controllers;

[ApiController]
[Authorize]
[Route("airlines")]
public sealed class AirlinesController(AirCharterExtendedContext context) : ControllerBase
{
    private const string AirlineProfileRoles = "Owner,GeneralDirector";

    private readonly AirCharterExtendedContext _context = context;

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
        Claim? userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);

        if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
            return null;

        return await _context.Users
            .AsNoTracking()
            .Where(user => user.Id == userId)
            .Select(user => user.AirlineId)
            .FirstOrDefaultAsync(cancellationToken);
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
}
