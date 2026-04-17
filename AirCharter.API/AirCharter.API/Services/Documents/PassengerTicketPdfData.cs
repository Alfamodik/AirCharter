namespace AirCharter.API.Services.Documents;

public sealed class PassengerTicketPdfData
{
    public required string PassengerName { get; init; }
    public required string PassengerDocument { get; init; }
    public required string ClassName { get; init; }
    public required string ElectronicTicketNumber { get; init; }
    public required string BookingCode { get; init; }
    public required string FlightNumber { get; init; }
    public required string AircraftType { get; init; }
    public required string FromCity { get; init; }
    public required string ToCity { get; init; }
    public required string FromAirportCode { get; init; }
    public required string ToAirportCode { get; init; }
    public required DateTime DepartureDateTime { get; init; }
    public required DateTime ArrivalDateTime { get; init; }
}