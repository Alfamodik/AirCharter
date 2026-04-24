using AirCharter.API.Responses.Airports;

namespace AirCharter.API.Responses.Flights
{
    public sealed class PlaneCatalogResponse
    {
        public int Id { get; set; }
        public string ModelName { get; set; } = string.Empty;
        public int PassengerCapacity { get; set; }
        public int MaxDistance { get; set; }
        public bool IsRouteFound { get; set; }
        public int DistanceKm { get; set; }
        public TimeSpan FlightTime { get; set; }
        public decimal FlightCost { get; set; }
        public int NumberOfTransfers { get; set; }
        public IReadOnlyCollection<AirportSearchResponse> RouteAirports { get; set; } = [];
        public string? ImageBase64 { get; set; }
    }
}