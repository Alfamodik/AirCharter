namespace AirCharter.API.Requests.Airlines;

public sealed class UpdateAirlineContractSettingsRequest
{
    public string AirlineName { get; set; } = null!;

    public string OrganizationType { get; set; } = null!;

    public string LegalAddress { get; set; } = null!;

    public string PostalAddress { get; set; } = null!;

    public string PhoneNumber { get; set; } = null!;

    public string Email { get; set; } = null!;

    public decimal? ServiceBaseCost { get; set; }

    public decimal? TransferBaseCost { get; set; }

    public string BankName { get; set; } = null!;

    public string TaxpayerId { get; set; } = null!;

    public string TaxRegistrationReasonCode { get; set; } = null!;

    public string PrimaryStateRegistrationNumber { get; set; } = null!;

    public string CurrentAccountNumber { get; set; } = null!;

    public string CorrespondentAccountNumber { get; set; } = null!;

    public string BankIdentifierCode { get; set; } = null!;

    public string? ContractCity { get; set; }

    public int? ContractValidityDays { get; set; }

    public int? PaymentDeadlineDays { get; set; }

    public string? CateringClass { get; set; }

    public int? PassengerArrivalMinutesBeforeFlight { get; set; }
}
