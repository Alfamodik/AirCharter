namespace AirCharter.API.Responses.Flights;

public sealed class RouteLegResponse
{
    public int FromAirportId { get; set; }

    public int ToAirportId { get; set; }

    public int DistanceKm { get; set; }

    public TimeSpan FlightTime { get; set; }
}