namespace AirCharter.API.Services.Routing;

public sealed class AirportGraph
{
    private readonly Dictionary<int, AirportRouteNode> _airportById;

    public AirportGraph(IReadOnlyCollection<AirportRouteNode> airports)
    {
        Airports = airports.ToArray();
        _airportById = new Dictionary<int, AirportRouteNode>(Airports.Count);

        foreach (AirportRouteNode airport in Airports)
        {
            if (!_airportById.ContainsKey(airport.Id))
                _airportById.Add(airport.Id, airport);
        }

        SpatialIndex = new AirportSpatialIndex(Airports);
    }

    public IReadOnlyList<AirportRouteNode> Airports { get; }

    public AirportSpatialIndex SpatialIndex { get; }

    public bool ContainsAirport(int airportId)
    {
        return _airportById.ContainsKey(airportId);
    }

    public AirportRouteNode GetAirport(int airportId)
    {
        return _airportById[airportId];
    }
}