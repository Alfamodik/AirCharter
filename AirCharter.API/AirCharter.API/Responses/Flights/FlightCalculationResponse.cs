namespace AirCharter.API.Responses.Flights
{
    public sealed class FlightCalculationResponse
    {
        public int DistanceKm { get; init; }
        public TimeSpan FlightTime { get; init; }
        public decimal FlightCost { get; init; }
        public int NumberOfTransfers { get; init; }
    }
}
