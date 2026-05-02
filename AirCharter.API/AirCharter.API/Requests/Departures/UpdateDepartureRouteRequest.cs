namespace AirCharter.API.Requests.Departures
{
    public sealed class UpdateDepartureRouteRequest
    {
        public IReadOnlyCollection<int> AirportIds { get; set; } = Array.Empty<int>();

        public IReadOnlyCollection<TimeSpan?> GroundTimesAfterArrival { get; set; } =
            Array.Empty<TimeSpan?>();
    }
}
