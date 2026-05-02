using AirCharter.API.Model;
using AirCharter.API.Responses.Airports;
using AirCharter.API.Responses.Flights;
using AirCharter.API.Services.Routing;

namespace AirCharter.API.Services;

public sealed class RoutePlanningService
{
    private const double RangeSafetyFactor = 0.85;
    private const double BaseOperationalDurationHours = 0.5;
    private const double TransferBaseDurationHours = 1.5;

    public IReadOnlyCollection<PlaneCatalogResponse> CalculateCatalog(
        IReadOnlyCollection<Plane> planes,
        AirportGraph airportGraph,
        int departureAirportId,
        int arrivalAirportId)
    {
        AirportRouteNode departureAirport = airportGraph.GetAirport(departureAirportId);
        AirportRouteNode arrivalAirport = airportGraph.GetAirport(arrivalAirportId);

        Dictionary<int, RoutePlan?> routePlanByMaximumLegDistance = new Dictionary<int, RoutePlan?>();
        List<PlaneCatalogResponse> planeCatalogResponses = new List<PlaneCatalogResponse>(planes.Count);

        foreach (Plane plane in planes)
        {
            if (plane.MaxDistance <= 0 || plane.CruisingSpeed <= 0)
            {
                planeCatalogResponses.Add(CreateRouteNotFoundResponse(plane));
                continue;
            }

            int maximumLegDistanceKilometers = GetMaximumLegDistanceKilometers(plane.MaxDistance);

            if (!routePlanByMaximumLegDistance.TryGetValue(
                    maximumLegDistanceKilometers,
                    out RoutePlan? routePlan))
            {
                routePlan = FindRoute(
                    airportGraph,
                    departureAirport,
                    arrivalAirport,
                    maximumLegDistanceKilometers);

                routePlanByMaximumLegDistance.Add(maximumLegDistanceKilometers, routePlan);
            }

            planeCatalogResponses.Add(CreatePlaneCatalogResponse(plane, routePlan));
        }

        return planeCatalogResponses;
    }

    public IReadOnlyCollection<RouteLegResponse> CalculateRouteLegs(
        Plane plane,
        IReadOnlyList<Airport> routeAirports,
        IReadOnlyList<TimeSpan?> groundTimesAfterArrival)
    {
        List<RouteSegment> routeSegments = new List<RouteSegment>(
            Math.Max(0, routeAirports.Count - 1));

        for (int routeAirportIndex = 1; routeAirportIndex < routeAirports.Count; routeAirportIndex++)
        {
            Airport fromAirport = routeAirports[routeAirportIndex - 1];
            Airport toAirport = routeAirports[routeAirportIndex];
            int distanceKilometers = GeoDistanceCalculator.CalculateDistanceKilometers(
                Convert.ToDouble(fromAirport.Latitude),
                Convert.ToDouble(fromAirport.Longitude),
                Convert.ToDouble(toAirport.Latitude),
                Convert.ToDouble(toAirport.Longitude));

            routeSegments.Add(new RouteSegment(
                fromAirport.Id,
                toAirport.Id,
                distanceKilometers));
        }

        return CreateRouteLegResponses(routeSegments, plane, groundTimesAfterArrival);
    }

    private static RoutePlan? FindRoute(
        AirportGraph airportGraph,
        AirportRouteNode departureAirport,
        AirportRouteNode arrivalAirport,
        int maximumLegDistanceKilometers)
    {
        int directDistanceKilometers = GeoDistanceCalculator.CalculateDistanceKilometers(
            departureAirport,
            arrivalAirport);

        if (directDistanceKilometers <= maximumLegDistanceKilometers)
        {
            return CreateDirectRoutePlan(
                departureAirport,
                arrivalAirport,
                directDistanceKilometers);
        }

        RouteSearchScore startScore = new RouteSearchScore(0, 0);

        Dictionary<int, RouteSearchScore> bestScoreByAirportId = new Dictionary<int, RouteSearchScore>
        {
            [departureAirport.Id] = startScore
        };

        Dictionary<int, int?> previousAirportIdByAirportId = new Dictionary<int, int?>
        {
            [departureAirport.Id] = null
        };

        Dictionary<int, int> legDistanceByAirportId = new Dictionary<int, int>();

        PriorityQueue<RouteSearchNode, RouteSearchPriority> queue =
            new PriorityQueue<RouteSearchNode, RouteSearchPriority>();

        queue.Enqueue(
            new RouteSearchNode(departureAirport.Id, startScore),
            CreatePriority(startScore, departureAirport, arrivalAirport, maximumLegDistanceKilometers));

        while (queue.Count > 0)
        {
            RouteSearchNode currentNode = queue.Dequeue();

            if (!bestScoreByAirportId.TryGetValue(
                    currentNode.AirportId,
                    out RouteSearchScore bestKnownScore))
            {
                continue;
            }

            if (bestKnownScore.CompareTo(currentNode.Score) < 0)
                continue;

            AirportRouteNode currentAirport = airportGraph.GetAirport(currentNode.AirportId);

            if (currentAirport.Id == arrivalAirport.Id)
            {
                return CreateRoutePlan(
                    airportGraph,
                    arrivalAirport.Id,
                    previousAirportIdByAirportId,
                    legDistanceByAirportId,
                    currentNode.Score.TotalDistanceKilometers);
            }

            foreach (AirportNeighbor airportNeighbor in airportGraph.SpatialIndex.FindAirportsWithinDistance(
                         currentAirport,
                         maximumLegDistanceKilometers))
            {
                AirportRouteNode candidateAirport = airportNeighbor.Airport;

                RouteSearchScore nextScore = new RouteSearchScore(
                    currentNode.Score.LegsCount + 1,
                    currentNode.Score.TotalDistanceKilometers + airportNeighbor.DistanceKilometers);

                if (bestScoreByAirportId.TryGetValue(
                        candidateAirport.Id,
                        out RouteSearchScore existingScore) &&
                    existingScore.CompareTo(nextScore) <= 0)
                {
                    continue;
                }

                bestScoreByAirportId[candidateAirport.Id] = nextScore;
                previousAirportIdByAirportId[candidateAirport.Id] = currentAirport.Id;
                legDistanceByAirportId[candidateAirport.Id] = airportNeighbor.DistanceKilometers;

                RouteSearchPriority nextPriority = CreatePriority(
                    nextScore,
                    candidateAirport,
                    arrivalAirport,
                    maximumLegDistanceKilometers);

                queue.Enqueue(
                    new RouteSearchNode(candidateAirport.Id, nextScore),
                    nextPriority);
            }
        }

        return null;
    }

    private static RouteSearchPriority CreatePriority(
        RouteSearchScore currentScore,
        AirportRouteNode currentAirport,
        AirportRouteNode arrivalAirport,
        int maximumLegDistanceKilometers)
    {
        int remainingDistanceKilometers = GeoDistanceCalculator.CalculateDistanceKilometers(
            currentAirport,
            arrivalAirport);

        int estimatedRemainingLegsCount = CalculateMinimumLegsCount(
            remainingDistanceKilometers,
            maximumLegDistanceKilometers);

        return new RouteSearchPriority(
            currentScore.LegsCount + estimatedRemainingLegsCount,
            currentScore.TotalDistanceKilometers + remainingDistanceKilometers,
            currentScore.LegsCount,
            currentScore.TotalDistanceKilometers);
    }

    private static int CalculateMinimumLegsCount(
        int distanceKilometers,
        int maximumLegDistanceKilometers)
    {
        if (distanceKilometers <= 0)
            return 0;

        return (int)Math.Ceiling((double)distanceKilometers / maximumLegDistanceKilometers);
    }

    private static RoutePlan CreateDirectRoutePlan(
        AirportRouteNode departureAirport,
        AirportRouteNode arrivalAirport,
        int directDistanceKilometers)
    {
        List<AirportSearchResponse> routeAirports = new List<AirportSearchResponse>
        {
            CreateAirportSearchResponse(departureAirport),
            CreateAirportSearchResponse(arrivalAirport)
        };

        List<RouteSegment> routeSegments = new List<RouteSegment>
        {
            new RouteSegment(
                departureAirport.Id,
                arrivalAirport.Id,
                directDistanceKilometers)
        };

        return new RoutePlan(
            routeAirports,
            routeSegments,
            directDistanceKilometers);
    }

    private static RoutePlan CreateRoutePlan(
        AirportGraph airportGraph,
        int arrivalAirportId,
        IReadOnlyDictionary<int, int?> previousAirportIdByAirportId,
        IReadOnlyDictionary<int, int> legDistanceByAirportId,
        int totalDistanceKilometers)
    {
        List<int> routeAirportIds = RebuildRouteAirportIds(
            arrivalAirportId,
            previousAirportIdByAirportId);

        List<AirportSearchResponse> routeAirports = new List<AirportSearchResponse>(routeAirportIds.Count);
        List<RouteSegment> routeSegments = new List<RouteSegment>(routeAirportIds.Count - 1);

        foreach (int airportId in routeAirportIds)
        {
            AirportRouteNode airport = airportGraph.GetAirport(airportId);
            routeAirports.Add(CreateAirportSearchResponse(airport));
        }

        for (int airportIndex = 1; airportIndex < routeAirportIds.Count; airportIndex++)
        {
            int fromAirportId = routeAirportIds[airportIndex - 1];
            int toAirportId = routeAirportIds[airportIndex];
            int distanceKilometers = legDistanceByAirportId[toAirportId];

            routeSegments.Add(new RouteSegment(
                fromAirportId,
                toAirportId,
                distanceKilometers));
        }

        return new RoutePlan(
            routeAirports,
            routeSegments,
            totalDistanceKilometers);
    }

    private static List<int> RebuildRouteAirportIds(
        int arrivalAirportId,
        IReadOnlyDictionary<int, int?> previousAirportIdByAirportId)
    {
        List<int> routeAirportIds = new List<int>();
        int? currentAirportId = arrivalAirportId;

        while (currentAirportId.HasValue)
        {
            routeAirportIds.Add(currentAirportId.Value);
            currentAirportId = previousAirportIdByAirportId[currentAirportId.Value];
        }

        routeAirportIds.Reverse();

        return routeAirportIds;
    }

    private static AirportSearchResponse CreateAirportSearchResponse(AirportRouteNode airport)
    {
        return new AirportSearchResponse
        {
            Id = airport.Id,
            Name = airport.Name,
            City = airport.City,
            Country = airport.Country,
            Iata = airport.Iata,
            Icao = airport.Icao,
            Latitude = airport.Latitude,
            Longitude = airport.Longitude
        };
    }

    private static PlaneCatalogResponse CreatePlaneCatalogResponse(
        Plane plane,
        RoutePlan? routePlan)
    {
        if (routePlan is null)
            return CreateRouteNotFoundResponse(plane);

        IReadOnlyCollection<RouteLegResponse> routeLegs = CreateRouteLegResponses(routePlan.RouteSegments, plane);
        int numberOfTransfers = Math.Max(0, routeLegs.Count - 1);

        return new PlaneCatalogResponse
        {
            Id = plane.Id,
            ModelName = plane.ModelName,
            PassengerCapacity = plane.PassengerCapacity,
            MaxDistance = plane.MaxDistance,
            IsRouteFound = true,
            DistanceKm = routeLegs.Sum(routeLeg => routeLeg.DistanceKm),
            FlightTime = CalculateRouteFlightTime(routeLegs),
            FlightCost = routeLegs.Sum(routeLeg => routeLeg.FlightCost),
            NumberOfTransfers = numberOfTransfers,
            RouteAirports = routePlan.RouteAirports,
            RouteLegs = routeLegs,
            ImageBase64 = ConvertImageToBase64(plane.Image)
        };
    }

    private static IReadOnlyCollection<RouteLegResponse> CreateRouteLegResponses(
        IReadOnlyCollection<RouteSegment> routeSegments,
        Plane plane)
    {
        return CreateRouteLegResponses(routeSegments, plane, Array.Empty<TimeSpan?>());
    }

    private static IReadOnlyCollection<RouteLegResponse> CreateRouteLegResponses(
        IReadOnlyCollection<RouteSegment> routeSegments,
        Plane plane,
        IReadOnlyList<TimeSpan?> groundTimesAfterArrival)
    {
        List<RouteLegResponse> routeLegResponses = new List<RouteLegResponse>(routeSegments.Count);
        int routeSegmentIndex = 0;

        foreach (RouteSegment routeSegment in routeSegments)
        {
            bool isLastRouteSegment = routeSegmentIndex == routeSegments.Count - 1;
            TimeSpan? groundTimeAfterArrival = null;

            if (!isLastRouteSegment)
            {
                groundTimeAfterArrival = routeSegmentIndex < groundTimesAfterArrival.Count
                    ? groundTimesAfterArrival[routeSegmentIndex]
                    : TimeSpan.FromHours(TransferBaseDurationHours);

                groundTimeAfterArrival ??= TimeSpan.FromHours(TransferBaseDurationHours);
            }

            routeLegResponses.Add(new RouteLegResponse
            {
                FromAirportId = routeSegment.FromAirportId,
                ToAirportId = routeSegment.ToAirportId,
                DistanceKm = routeSegment.DistanceKilometers,
                FlightTime = CalculateLegFlightTime(routeSegment.DistanceKilometers, plane.CruisingSpeed),
                FlightCost = decimal.Round(CalculateLegFlightCost(
                    routeSegment.DistanceKilometers,
                    plane,
                    routeSegmentIndex,
                    isLastRouteSegment), 0),
                GroundTimeAfterArrival = groundTimeAfterArrival
            });

            routeSegmentIndex++;
        }

        return routeLegResponses;
    }

    private static PlaneCatalogResponse CreateRouteNotFoundResponse(Plane plane)
    {
        return new PlaneCatalogResponse
        {
            Id = plane.Id,
            ModelName = plane.ModelName,
            PassengerCapacity = plane.PassengerCapacity,
            MaxDistance = plane.MaxDistance,
            IsRouteFound = false,
            DistanceKm = 0,
            FlightTime = TimeSpan.Zero,
            FlightCost = 0,
            NumberOfTransfers = 0,
            RouteAirports = Array.Empty<AirportSearchResponse>(),
            RouteLegs = Array.Empty<RouteLegResponse>(),
            ImageBase64 = ConvertImageToBase64(plane.Image)
        };
    }

    public static int GetMaximumLegDistanceKilometers(int maxDistance)
    {
        return Math.Max(1, (int)Math.Floor(maxDistance * RangeSafetyFactor));
    }

    private static TimeSpan CalculateLegFlightTime(
        int distanceKilometers,
        int cruisingSpeed)
    {
        if (cruisingSpeed <= 0)
            return TimeSpan.Zero;

        double flightDurationHours = (double)distanceKilometers / cruisingSpeed;

        return TimeSpan.FromHours(flightDurationHours);
    }

    private static TimeSpan CalculateRouteFlightTime(IReadOnlyCollection<RouteLegResponse> routeLegs)
    {
        TimeSpan flightTime = TimeSpan.FromHours(BaseOperationalDurationHours);

        foreach (RouteLegResponse routeLeg in routeLegs)
        {
            flightTime += routeLeg.FlightTime;

            if (routeLeg.GroundTimeAfterArrival is not null)
                flightTime += routeLeg.GroundTimeAfterArrival.Value;
        }

        return flightTime;
    }

    private static decimal CalculateLegFlightCost(
        int distanceKilometers,
        Plane plane,
        int routeSegmentIndex,
        bool isLastRouteSegment)
    {
        if (plane.CruisingSpeed <= 0 || plane.Airline is null)
            return 0;

        Airline airline = plane.Airline;

        decimal flightDurationHours = (decimal)distanceKilometers / plane.CruisingSpeed;
        decimal flightCostByHours = flightDurationHours * plane.FlightHourCost;
        decimal serviceBaseCost = routeSegmentIndex == 0
            ? airline.ServiceBaseCost
            : 0;
        decimal transferBaseCost = isLastRouteSegment
            ? 0
            : airline.TransferBaseCost;

        return flightCostByHours + serviceBaseCost + transferBaseCost;
    }

    private static string? ConvertImageToBase64(byte[]? image)
    {
        if (image is null || image.Length == 0)
            return null;

        return Convert.ToBase64String(image);
    }

    private sealed class RoutePlan
    {
        public RoutePlan(
            IReadOnlyCollection<AirportSearchResponse> routeAirports,
            IReadOnlyCollection<RouteSegment> routeSegments,
            int totalDistanceKilometers)
        {
            RouteAirports = routeAirports;
            RouteSegments = routeSegments;
            TotalDistanceKilometers = totalDistanceKilometers;
        }

        public IReadOnlyCollection<AirportSearchResponse> RouteAirports { get; }

        public IReadOnlyCollection<RouteSegment> RouteSegments { get; }

        public int TotalDistanceKilometers { get; }
    }

    private readonly record struct RouteSegment(
        int FromAirportId,
        int ToAirportId,
        int DistanceKilometers);

    private readonly record struct RouteSearchNode(
        int AirportId,
        RouteSearchScore Score);

    private readonly record struct RouteSearchScore(
        int LegsCount,
        int TotalDistanceKilometers) : IComparable<RouteSearchScore>
    {
        public int CompareTo(RouteSearchScore other)
        {
            int legsComparison = LegsCount.CompareTo(other.LegsCount);

            if (legsComparison != 0)
                return legsComparison;

            return TotalDistanceKilometers.CompareTo(other.TotalDistanceKilometers);
        }
    }

    private readonly record struct RouteSearchPriority(
        int EstimatedLegsCount,
        int EstimatedTotalDistanceKilometers,
        int ActualLegsCount,
        int ActualTotalDistanceKilometers) : IComparable<RouteSearchPriority>
    {
        public int CompareTo(RouteSearchPriority other)
        {
            int estimatedLegsComparison = EstimatedLegsCount.CompareTo(other.EstimatedLegsCount);

            if (estimatedLegsComparison != 0)
                return estimatedLegsComparison;

            int estimatedDistanceComparison = EstimatedTotalDistanceKilometers.CompareTo(
                other.EstimatedTotalDistanceKilometers);

            if (estimatedDistanceComparison != 0)
                return estimatedDistanceComparison;

            int actualLegsComparison = ActualLegsCount.CompareTo(other.ActualLegsCount);

            if (actualLegsComparison != 0)
                return actualLegsComparison;

            return ActualTotalDistanceKilometers.CompareTo(other.ActualTotalDistanceKilometers);
        }
    }
}
