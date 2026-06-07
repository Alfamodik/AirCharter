// DTO ответа FlightCalculationResponse описывает данные, которые API возвращает frontend после обработки запроса.

using AirCharter.API.Responses.Airports;

namespace AirCharter.API.Responses.Flights
{
    public sealed class FlightCalculationResponse
    {
        public bool IsRouteFound { get; set; }
        public int DistanceKm { get; set; }
        public TimeSpan FlightTime { get; set; }
        public decimal FlightCost { get; set; }
        public int NumberOfTransfers { get; set; }
        public IReadOnlyCollection<AirportSearchResponse> RouteAirports { get; set; } = [];
    }
}