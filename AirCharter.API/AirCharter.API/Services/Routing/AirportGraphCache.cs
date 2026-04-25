using AirCharter.API.Model;
using AirCharter.API.Services.Routing;
using Microsoft.EntityFrameworkCore;

namespace AirCharter.API.Services;

public sealed class AirportGraphCache
{
    private readonly SemaphoreSlim _semaphore = new SemaphoreSlim(1, 1);

    private AirportGraph? _airportGraph;

    public async Task<AirportGraph> GetOrCreateAsync(
        AirCharterExtendedContext context,
        CancellationToken cancellationToken)
    {
        if (_airportGraph is not null)
            return _airportGraph;

        await _semaphore.WaitAsync(cancellationToken);

        try
        {
            if (_airportGraph is not null)
                return _airportGraph;

            List<AirportRouteNode> airportRouteNodes = await context.Airports
                .AsNoTracking()
                .Select(airport => new AirportRouteNode(
                    airport.Id,
                    airport.Name,
                    airport.City,
                    airport.Country,
                    airport.Iata,
                    airport.Icao,
                    airport.Latitude,
                    airport.Longitude))
                .ToListAsync(cancellationToken);

            _airportGraph = new AirportGraph(airportRouteNodes);

            return _airportGraph;
        }
        finally
        {
            _semaphore.Release();
        }
    }
}