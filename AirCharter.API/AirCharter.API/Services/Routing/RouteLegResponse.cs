// Часть маршрутизатора аэропортов RouteLegResponse помогает строить перелет по узлам, расстояниям и доступным промежуточным точкам.

namespace AirCharter.API.Responses.Flights;

public sealed class RouteLegResponse
{
    public int FromAirportId { get; set; }

    public int ToAirportId { get; set; }

    public int DistanceKm { get; set; }

    public TimeSpan FlightTime { get; set; }

    public decimal FlightCost { get; set; }

    public TimeSpan? GroundTimeAfterArrival { get; set; }
}
