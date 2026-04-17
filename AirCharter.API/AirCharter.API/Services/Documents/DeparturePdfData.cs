namespace AirCharter.API.Services.Documents;

public sealed class DeparturePdfData
{
    public required int DepartureId { get; init; }
    public required string OrderNumber { get; init; }
    public required DateTime IssueDate { get; init; }
    public required string PaymentMethod { get; init; }
    public required decimal TotalPrice { get; init; }
    public required string CurrencySymbol { get; init; }
    public required IReadOnlyCollection<PassengerTicketPdfData> Tickets { get; init; }
}