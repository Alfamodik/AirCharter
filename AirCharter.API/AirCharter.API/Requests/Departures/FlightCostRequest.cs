namespace AirCharter.API.Requests.Departures
{
    public sealed class FlightCostRequest
    {
        public int PlaneId { get; set; }
        public int TakeOffAirportId { get; set; }
        public int LandingAirportId { get; set; }
    }
}
