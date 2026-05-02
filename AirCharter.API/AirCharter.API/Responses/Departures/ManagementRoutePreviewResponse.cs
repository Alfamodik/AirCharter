namespace AirCharter.API.Responses.Departures
{
    using AirCharter.API.Responses.Airports;

    public sealed class ManagementRoutePreviewResponse
    {
        public int Distance { get; set; }

        public TimeSpan FlightTime { get; set; }

        public decimal Price { get; set; }

        public int Transfers { get; set; }

        public bool CanFly { get; set; }

        public IReadOnlyCollection<AirportSearchResponse> RouteAirports { get; set; } =
            Array.Empty<AirportSearchResponse>();

        public IReadOnlyCollection<ManagementRoutePreviewLegResponse> RouteLegs { get; set; } =
            Array.Empty<ManagementRoutePreviewLegResponse>();
    }

    public sealed class ManagementRoutePreviewLegResponse
    {
        public int FromAirportId { get; set; }

        public int ToAirportId { get; set; }

        public int DistanceKm { get; set; }

        public TimeSpan FlightTime { get; set; }

        public decimal FlightCost { get; set; }

        public TimeSpan? GroundTimeAfterArrival { get; set; }

        public bool CanFly { get; set; }

        public int MaximumLegDistanceKm { get; set; }
    }
}
