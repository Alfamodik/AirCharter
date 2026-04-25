namespace AirCharter.API.Services.Routing;

public sealed class AirportSpatialIndex
{
    private const double CellSizeDegrees = 2.0;
    private const double EarthRadiusKilometers = 6371.0;
    private const int LatitudeCellsCount = 90;
    private const int LongitudeCellsCount = 180;

    private readonly Dictionary<GridCell, List<AirportRouteNode>> _airportsByCell;

    public AirportSpatialIndex(IReadOnlyCollection<AirportRouteNode> airports)
    {
        _airportsByCell = new Dictionary<GridCell, List<AirportRouteNode>>();

        foreach (AirportRouteNode airport in airports)
        {
            GridCell gridCell = CreateGridCell(
                airport.LatitudeDouble,
                airport.LongitudeDouble);

            if (!_airportsByCell.TryGetValue(gridCell, out List<AirportRouteNode>? cellAirports))
            {
                cellAirports = new List<AirportRouteNode>();
                _airportsByCell.Add(gridCell, cellAirports);
            }

            cellAirports.Add(airport);
        }
    }

    public IEnumerable<AirportNeighbor> FindAirportsWithinDistance(
        AirportRouteNode centerAirport,
        int maximumDistanceKilometers)
    {
        double latitudeDeltaDegrees = maximumDistanceKilometers / EarthRadiusKilometers * 180.0 / Math.PI;
        double longitudeDeltaDegrees = CalculateLongitudeDeltaDegrees(centerAirport, maximumDistanceKilometers);

        int minimumLatitudeCell = GetLatitudeCell(centerAirport.LatitudeDouble - latitudeDeltaDegrees);
        int maximumLatitudeCell = GetLatitudeCell(centerAirport.LatitudeDouble + latitudeDeltaDegrees);

        if (longitudeDeltaDegrees >= 180.0)
        {
            foreach (AirportNeighbor airportNeighbor in FindAirportsInLatitudeRange(
                         centerAirport,
                         maximumDistanceKilometers,
                         minimumLatitudeCell,
                         maximumLatitudeCell,
                         0,
                         LongitudeCellsCount - 1,
                         false))
            {
                yield return airportNeighbor;
            }

            yield break;
        }

        int minimumLongitudeCell = GetRawLongitudeCell(centerAirport.LongitudeDouble - longitudeDeltaDegrees);
        int maximumLongitudeCell = GetRawLongitudeCell(centerAirport.LongitudeDouble + longitudeDeltaDegrees);

        foreach (AirportNeighbor airportNeighbor in FindAirportsInLatitudeRange(
                     centerAirport,
                     maximumDistanceKilometers,
                     minimumLatitudeCell,
                     maximumLatitudeCell,
                     minimumLongitudeCell,
                     maximumLongitudeCell,
                     true))
        {
            yield return airportNeighbor;
        }
    }

    private IEnumerable<AirportNeighbor> FindAirportsInLatitudeRange(
        AirportRouteNode centerAirport,
        int maximumDistanceKilometers,
        int minimumLatitudeCell,
        int maximumLatitudeCell,
        int minimumLongitudeCell,
        int maximumLongitudeCell,
        bool shouldNormalizeLongitudeCell)
    {
        for (int latitudeCell = minimumLatitudeCell; latitudeCell <= maximumLatitudeCell; latitudeCell++)
        {
            for (int longitudeCell = minimumLongitudeCell; longitudeCell <= maximumLongitudeCell; longitudeCell++)
            {
                int normalizedLongitudeCell = shouldNormalizeLongitudeCell
                    ? NormalizeLongitudeCell(longitudeCell)
                    : longitudeCell;

                GridCell gridCell = new GridCell(latitudeCell, normalizedLongitudeCell);

                if (!_airportsByCell.TryGetValue(gridCell, out List<AirportRouteNode>? cellAirports))
                    continue;

                foreach (AirportRouteNode candidateAirport in cellAirports)
                {
                    if (candidateAirport.Id == centerAirport.Id)
                        continue;

                    int distanceKilometers = GeoDistanceCalculator.CalculateDistanceKilometers(
                        centerAirport,
                        candidateAirport);

                    if (distanceKilometers > maximumDistanceKilometers)
                        continue;

                    yield return new AirportNeighbor(candidateAirport, distanceKilometers);
                }
            }
        }
    }

    private static GridCell CreateGridCell(double latitude, double longitude)
    {
        return new GridCell(
            GetLatitudeCell(latitude),
            GetLongitudeCell(longitude));
    }

    private static int GetLatitudeCell(double latitude)
    {
        double normalizedLatitude = latitude + 90.0;
        int latitudeCell = (int)Math.Floor(normalizedLatitude / CellSizeDegrees);

        if (latitudeCell < 0)
            return 0;

        if (latitudeCell >= LatitudeCellsCount)
            return LatitudeCellsCount - 1;

        return latitudeCell;
    }

    private static int GetLongitudeCell(double longitude)
    {
        double normalizedLongitude = NormalizeLongitude(longitude) + 180.0;
        int longitudeCell = (int)Math.Floor(normalizedLongitude / CellSizeDegrees);

        if (longitudeCell < 0)
            return 0;

        if (longitudeCell >= LongitudeCellsCount)
            return LongitudeCellsCount - 1;

        return longitudeCell;
    }

    private static int GetRawLongitudeCell(double longitude)
    {
        double normalizedLongitude = longitude + 180.0;
        return (int)Math.Floor(normalizedLongitude / CellSizeDegrees);
    }

    private static int NormalizeLongitudeCell(int longitudeCell)
    {
        int normalizedLongitudeCell = longitudeCell % LongitudeCellsCount;

        if (normalizedLongitudeCell < 0)
            normalizedLongitudeCell += LongitudeCellsCount;

        return normalizedLongitudeCell;
    }

    private static double NormalizeLongitude(double longitude)
    {
        double normalizedLongitude = longitude;

        while (normalizedLongitude < -180.0)
            normalizedLongitude += 360.0;

        while (normalizedLongitude >= 180.0)
            normalizedLongitude -= 360.0;

        return normalizedLongitude;
    }

    private static double CalculateLongitudeDeltaDegrees(
        AirportRouteNode centerAirport,
        int maximumDistanceKilometers)
    {
        double latitudeCosine = Math.Cos(centerAirport.LatitudeRadians);

        if (Math.Abs(latitudeCosine) < 0.01)
            return 180.0;

        double longitudeDeltaDegrees =
            maximumDistanceKilometers /
            (EarthRadiusKilometers * Math.Abs(latitudeCosine)) *
            180.0 /
            Math.PI;

        if (longitudeDeltaDegrees > 180.0)
            return 180.0;

        return longitudeDeltaDegrees;
    }

    private readonly record struct GridCell(
        int LatitudeCell,
        int LongitudeCell);
}