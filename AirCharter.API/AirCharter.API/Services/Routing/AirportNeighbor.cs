namespace AirCharter.API.Services.Routing;

public readonly record struct AirportNeighbor(
    AirportRouteNode Airport,
    int DistanceKilometers);