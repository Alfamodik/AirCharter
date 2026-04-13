namespace AirCharter.API.Responses.Departures
{
    public sealed class ManagementDepartureResponse
    {
        public int Id { get; set; }
        public string PlaneModelName { get; set; } = string.Empty;

        public string TakeOffAirportName { get; set; } = string.Empty;
        public string? TakeOffAirportCity { get; set; }
        public string? TakeOffAirportIata { get; set; }
        public string? TakeOffAirportIcao { get; set; }

        public string LandingAirportName { get; set; } = string.Empty;
        public string? LandingAirportCity { get; set; }
        public string? LandingAirportIata { get; set; }
        public string? LandingAirportIcao { get; set; }

        public DateTime RequestedTakeOffDateTime { get; set; }
        public decimal Price { get; set; }
        public string StatusName { get; set; } = string.Empty;
        public string CharterRequesterEmail { get; set; } = string.Empty;
    }
}