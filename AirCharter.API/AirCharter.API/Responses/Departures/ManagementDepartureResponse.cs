using AirCharter.API.Responses.Airports;
using AirCharter.API.Responses.Flights;

namespace AirCharter.API.Responses.Departures
{
    public sealed class ManagementDepartureResponse
    {
        public int Id { get; set; }

        public string PlaneModelName { get; set; } = string.Empty;

        public int PlanePassengerCapacity { get; set; }

        public int TakeOffAirportId { get; set; }

        public string TakeOffAirportName { get; set; } = string.Empty;

        public string? TakeOffAirportCity { get; set; }

        public string? TakeOffAirportIata { get; set; }

        public string? TakeOffAirportIcao { get; set; }

        public int LandingAirportId { get; set; }

        public string LandingAirportName { get; set; } = string.Empty;

        public string? LandingAirportCity { get; set; }

        public string? LandingAirportIata { get; set; }

        public string? LandingAirportIcao { get; set; }

        public DateTime RequestedTakeOffDateTime { get; set; }

        public DateTime ArrivalDateTime { get; set; }

        public DateTime? CreatedAt { get; set; }

        public decimal Price { get; set; }

        public int Distance { get; set; }

        public TimeSpan FlightTime { get; set; }

        public int Transfers { get; set; }

        public int CurrentStatusId { get; set; }

        public string StatusName { get; set; } = string.Empty;

        public DateTime CurrentStatusSetAt { get; set; }

        public string CharterRequesterEmail { get; set; } = string.Empty;

        public int PassengerCount { get; set; }

        public bool CanEditRoute { get; set; }

        public bool CanApprove { get; set; }

        public bool CanChangeStatus { get; set; }

        public IReadOnlyCollection<ManagementPassengerResponse> Passengers { get; set; } =
            Array.Empty<ManagementPassengerResponse>();

        public IReadOnlyCollection<ManagementDepartureStatusResponse> StatusHistory { get; set; } =
            Array.Empty<ManagementDepartureStatusResponse>();

        public IReadOnlyCollection<AirportSearchResponse> RouteAirports { get; set; } =
            Array.Empty<AirportSearchResponse>();

        public IReadOnlyCollection<RouteLegResponse> RouteLegs { get; set; } =
            Array.Empty<RouteLegResponse>();
    }

    public sealed class ManagementPassengerResponse
    {
        public int Id { get; set; }

        public string FullName { get; set; } = string.Empty;

        public string? Email { get; set; }
    }

    public sealed class ManagementDepartureStatusResponse
    {
        public int Id { get; set; }

        public string Name { get; set; } = string.Empty;

        public DateTime SetAt { get; set; }
    }
}
