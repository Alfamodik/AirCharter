namespace AirCharter.API.Services.Documents;

public sealed class ContractPdfData
{
    public required string ContractNumber { get; init; }
    public required string OrderNumber { get; init; }
    public required string ContractCity { get; init; }
    public required DateTime ContractDate { get; init; }
    public required DateOnly ContractEndDate { get; init; }
    public required DateOnly PaymentDeadlineDate { get; init; }
    public required string ExecutorFullName { get; init; }
    public required string ExecutorShortName { get; init; }
    public required string ExecutorLegalAddress { get; init; }
    public required string ExecutorPostalAddress { get; init; }
    public required string ExecutorTaxpayerId { get; init; }
    public required string ExecutorTaxRegistrationReasonCode { get; init; }
    public required string ExecutorPrimaryStateRegistrationNumber { get; init; }
    public required string ExecutorCurrentAccountNumber { get; init; }
    public required string ExecutorBankName { get; init; }
    public required string ExecutorCorrespondentAccountNumber { get; init; }
    public required string ExecutorBankIdentifierCode { get; init; }
    public required string ExecutorEmail { get; init; }
    public required string ExecutorPhoneNumber { get; init; }
    public required string ExecutorDirectorFullName { get; init; }
    public required string ExecutorDirectorInitials { get; init; }
    public required string ExecutorDirectorPosition { get; init; }
    public required string CustomerFullName { get; init; }
    public required string CustomerInitials { get; init; }
    public required string CustomerRegistrationAddress { get; init; }
    public required string CustomerActualAddress { get; init; }
    public required string CustomerPassportSeries { get; init; }
    public required string CustomerPassportNumber { get; init; }
    public required string CustomerTaxpayerId { get; init; }
    public required string CustomerBankName { get; init; }
    public required string CustomerCurrentAccountNumber { get; init; }
    public required string CustomerBankIdentifierCode { get; init; }
    public required string CustomerEmail { get; init; }
    public required string CustomerPhoneNumber { get; init; }
    public required string PlaneModelName { get; init; }
    public required string RouteText { get; init; }
    public required string TakeOffAirport { get; init; }
    public required string LandingAirport { get; init; }
    public required DateTime TakeOffDateTime { get; init; }
    public required DateTime LandingDateTime { get; init; }
    public required TimeSpan FlightTime { get; init; }
    public required int PassengerCount { get; init; }
    public required int PassengerArrivalMinutesBeforeFlight { get; init; }
    public required string PassengerArrivalText { get; init; }
    public required string CateringClass { get; init; }
    public required decimal FlightPrice { get; init; }
    public required string FlightPriceText { get; init; }
}

public sealed class ContractPdfDataResult
{
    public ContractPdfData? Data { get; init; }
    public IReadOnlyCollection<string> MissingFields { get; init; } = Array.Empty<string>();
}
