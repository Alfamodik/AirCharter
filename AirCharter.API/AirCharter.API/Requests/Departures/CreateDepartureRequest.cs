namespace AirCharter.API.Requests.Departures
{
    public sealed class CreateDepartureRequest
    {
        public int PlaneId { get; init; }
        public int TakeOffAirportId { get; init; }
        public int LandingAirportId { get; init; }
        public DateTime RequestedTakeOffDateTime { get; init; }
    }
}
