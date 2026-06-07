// Часть маршрутизатора аэропортов AirportNeighbor помогает строить перелет по узлам, расстояниям и доступным промежуточным точкам.

namespace AirCharter.API.Services.Routing;

public readonly record struct AirportNeighbor(
    AirportRouteNode Airport,
    int DistanceKilometers);