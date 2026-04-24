using AirCharter.API.Model;
using AirCharter.API.Responses.Airports;
using AirCharter.API.Responses.Flights;

namespace AirCharter.API.Services
{
    public sealed class RoutePlanningService
    {
        private const double RangeSafetyFactor = 0.85;
        private const double BaseOperationalDurationHours = 0.5;
        private const double TransferBaseDurationHours = 1.5;

        private readonly FlightLegCalculationService _flightLegCalculationService;

        public RoutePlanningService(FlightLegCalculationService flightLegCalculationService)
        {
            _flightLegCalculationService = flightLegCalculationService;
        }

        public PlaneCatalogResponse Calculate(
            Plane plane,
            Airport departureAirport,
            Airport arrivalAirport,
            IReadOnlyCollection<Airport> airports)
        {
            FlightCalculationResponse calculation = CalculateFlight(
                plane,
                departureAirport,
                arrivalAirport,
                airports);

            return new PlaneCatalogResponse
            {
                Id = plane.Id,
                ModelName = plane.ModelName,
                PassengerCapacity = plane.PassengerCapacity,
                MaxDistance = plane.MaxDistance,
                IsRouteFound = calculation.IsRouteFound,
                DistanceKm = calculation.DistanceKm,
                FlightTime = calculation.FlightTime,
                FlightCost = calculation.FlightCost,
                NumberOfTransfers = calculation.NumberOfTransfers,
                RouteAirports = calculation.RouteAirports,
                ImageBase64 = ConvertImageToBase64(plane.Image)
            };
        }

        public FlightCalculationResponse CalculateFlight(
            Plane plane,
            Airport departureAirport,
            Airport arrivalAirport,
            IReadOnlyCollection<Airport> airports)
        {
            if (plane.MaxDistance <= 0 || plane.CruisingSpeed <= 0 || plane.Airline is null)
                return CreateRouteNotFoundResponse();

            RoutePlan? routePlan = FindRoute(plane, departureAirport, arrivalAirport, airports);

            if (routePlan is null)
                return CreateRouteNotFoundResponse();

            int numberOfTransfers = Math.Max(0, routePlan.RouteAirports.Count - 2);
            TimeSpan flightTime = CalculateRouteFlightTime(
                routePlan.TotalDistanceKilometers,
                plane.CruisingSpeed,
                numberOfTransfers);

            decimal flightCost = CalculateRouteFlightCost(
                routePlan.TotalDistanceKilometers,
                plane,
                numberOfTransfers);

            return new FlightCalculationResponse
            {
                IsRouteFound = true,
                DistanceKm = routePlan.TotalDistanceKilometers,
                FlightTime = flightTime,
                FlightCost = decimal.Round(flightCost, 0),
                NumberOfTransfers = numberOfTransfers,
                RouteAirports = routePlan.RouteAirports
            };
        }

        private RoutePlan? FindRoute(
            Plane plane,
            Airport departureAirport,
            Airport arrivalAirport,
            IReadOnlyCollection<Airport> airports)
        {
            int maximumLegDistanceKilometers = GetMaximumLegDistanceKilometers(plane.MaxDistance);
            Dictionary<int, Airport> airportById = CreateAirportDictionary(
                airports,
                departureAirport,
                arrivalAirport);

            RoutePriority startPriority = new RoutePriority(0, 0);

            Dictionary<int, RoutePriority> bestPriorityByAirportId = new Dictionary<int, RoutePriority>
            {
                [departureAirport.Id] = startPriority
            };

            Dictionary<int, int?> previousAirportIdByAirportId = new Dictionary<int, int?>
            {
                [departureAirport.Id] = null
            };

            Dictionary<int, int> legDistanceByAirportId = new Dictionary<int, int>();

            PriorityQueue<RouteNode, RoutePriority> queue = new PriorityQueue<RouteNode, RoutePriority>();

            queue.Enqueue(
                new RouteNode(departureAirport.Id, startPriority),
                startPriority);

            while (queue.Count > 0)
            {
                RouteNode currentNode = queue.Dequeue();

                if (!bestPriorityByAirportId.TryGetValue(
                        currentNode.AirportId,
                        out RoutePriority bestKnownPriority))
                {
                    continue;
                }

                if (bestKnownPriority.CompareTo(currentNode.Priority) < 0)
                    continue;

                if (currentNode.AirportId == arrivalAirport.Id)
                    break;

                Airport currentAirport = airportById[currentNode.AirportId];

                foreach (Airport candidateAirport in airportById.Values)
                {
                    if (candidateAirport.Id == currentAirport.Id)
                        continue;

                    int legDistanceKilometers = _flightLegCalculationService.CalculateDistanceKilometers(
                        currentAirport,
                        candidateAirport);

                    if (legDistanceKilometers > maximumLegDistanceKilometers)
                        continue;

                    RoutePriority nextPriority = new RoutePriority(
                        currentNode.Priority.LegsCount + 1,
                        currentNode.Priority.TotalDistanceKilometers + legDistanceKilometers);

                    if (bestPriorityByAirportId.TryGetValue(
                            candidateAirport.Id,
                            out RoutePriority existingPriority) &&
                        existingPriority.CompareTo(nextPriority) <= 0)
                    {
                        continue;
                    }

                    bestPriorityByAirportId[candidateAirport.Id] = nextPriority;
                    previousAirportIdByAirportId[candidateAirport.Id] = currentAirport.Id;
                    legDistanceByAirportId[candidateAirport.Id] = legDistanceKilometers;

                    queue.Enqueue(
                        new RouteNode(candidateAirport.Id, nextPriority),
                        nextPriority);
                }
            }

            if (!bestPriorityByAirportId.ContainsKey(arrivalAirport.Id))
                return null;

            List<int> routeAirportIds = RebuildRouteAirportIds(
                arrivalAirport.Id,
                previousAirportIdByAirportId);

            List<AirportSearchResponse> routeAirports = new List<AirportSearchResponse>(routeAirportIds.Count);

            foreach (int airportId in routeAirportIds)
            {
                Airport airport = airportById[airportId];

                routeAirports.Add(new AirportSearchResponse
                {
                    Id = airport.Id,
                    Name = airport.Name,
                    City = airport.City,
                    Country = airport.Country,
                    Iata = airport.Iata,
                    Icao = airport.Icao
                });
            }

            int totalDistanceKilometers = 0;

            for (int airportIndex = 1; airportIndex < routeAirportIds.Count; airportIndex++)
            {
                int airportId = routeAirportIds[airportIndex];
                totalDistanceKilometers += legDistanceByAirportId[airportId];
            }

            return new RoutePlan(routeAirports, totalDistanceKilometers);
        }

        private static Dictionary<int, Airport> CreateAirportDictionary(
            IReadOnlyCollection<Airport> airports,
            Airport departureAirport,
            Airport arrivalAirport)
        {
            Dictionary<int, Airport> airportById = new Dictionary<int, Airport>();

            foreach (Airport airport in airports)
            {
                if (!airportById.ContainsKey(airport.Id))
                    airportById.Add(airport.Id, airport);
            }

            if (!airportById.ContainsKey(departureAirport.Id))
                airportById.Add(departureAirport.Id, departureAirport);

            if (!airportById.ContainsKey(arrivalAirport.Id))
                airportById.Add(arrivalAirport.Id, arrivalAirport);

            return airportById;
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

        private static int GetMaximumLegDistanceKilometers(int maxDistance)
        {
            return Math.Max(1, (int)Math.Floor(maxDistance * RangeSafetyFactor));
        }

        private static TimeSpan CalculateRouteFlightTime(
            int distanceKilometers,
            int cruisingSpeed,
            int numberOfTransfers)
        {
            if (cruisingSpeed <= 0)
                return TimeSpan.Zero;

            double flightDurationHours = (double)distanceKilometers / cruisingSpeed;
            double transferDurationHours = numberOfTransfers * TransferBaseDurationHours;

            return TimeSpan.FromHours(
                flightDurationHours +
                BaseOperationalDurationHours +
                transferDurationHours);
        }

        private static decimal CalculateRouteFlightCost(
            int distanceKilometers,
            Plane plane,
            int numberOfTransfers)
        {
            if (plane.CruisingSpeed <= 0 || plane.Airline is null)
                return 0;

            Airline airline = plane.Airline;

            decimal flightDurationHours = (decimal)distanceKilometers / plane.CruisingSpeed;
            decimal flightCostByHours = flightDurationHours * plane.FlightHourCost;
            decimal serviceBaseCost = airline.ServiceBaseCost;
            decimal transferBaseCost = numberOfTransfers * airline.TransferBaseCost;

            return flightCostByHours + serviceBaseCost + transferBaseCost;
        }

        private static FlightCalculationResponse CreateRouteNotFoundResponse()
        {
            return new FlightCalculationResponse
            {
                IsRouteFound = false,
                DistanceKm = 0,
                FlightTime = TimeSpan.Zero,
                FlightCost = 0,
                NumberOfTransfers = 0,
                RouteAirports = Array.Empty<AirportSearchResponse>()
            };
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
                int totalDistanceKilometers)
            {
                RouteAirports = routeAirports;
                TotalDistanceKilometers = totalDistanceKilometers;
            }

            public IReadOnlyCollection<AirportSearchResponse> RouteAirports { get; }
            public int TotalDistanceKilometers { get; }
        }

        private sealed class RouteNode
        {
            public RouteNode(int airportId, RoutePriority priority)
            {
                AirportId = airportId;
                Priority = priority;
            }

            public int AirportId { get; }
            public RoutePriority Priority { get; }
        }

        private readonly record struct RoutePriority(
            int LegsCount,
            int TotalDistanceKilometers) : IComparable<RoutePriority>
        {
            public int CompareTo(RoutePriority other)
            {
                int legsComparison = LegsCount.CompareTo(other.LegsCount);

                if (legsComparison != 0)
                    return legsComparison;

                return TotalDistanceKilometers.CompareTo(other.TotalDistanceKilometers);
            }
        }
    }
}