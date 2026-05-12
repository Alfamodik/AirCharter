namespace AirCharter.API.Requests.Airlines;

public sealed class RegisterAirlineRequest
{
    public string AirlineName { get; set; } = string.Empty;

    public string OrganizationType { get; set; } = string.Empty;

    public string LegalAddress { get; set; } = string.Empty;

    public string PostalAddress { get; set; } = string.Empty;

    public string PhoneNumber { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public decimal? ServiceBaseCost { get; set; }

    public decimal? TransferBaseCost { get; set; }

    public string BankName { get; set; } = string.Empty;

    public string TaxpayerId { get; set; } = string.Empty;

    public string TaxRegistrationReasonCode { get; set; } = string.Empty;

    public string PrimaryStateRegistrationNumber { get; set; } = string.Empty;

    public string CurrentAccountNumber { get; set; } = string.Empty;

    public string CorrespondentAccountNumber { get; set; } = string.Empty;

    public string BankIdentifierCode { get; set; } = string.Empty;

    public string? ContractCity { get; set; }

    public int? ContractValidityDays { get; set; }

    public int? PaymentDeadlineDays { get; set; }

    public string? CateringClass { get; set; }

    public int? PassengerArrivalMinutesBeforeFlight { get; set; }
}
