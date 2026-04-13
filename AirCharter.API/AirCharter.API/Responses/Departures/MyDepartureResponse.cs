namespace AirCharter.API.Responses.Departures
{
    public sealed class MyDepartureResponse
    {
        public int Id { get; set; }
        public string ModelName { get; set; } = string.Empty;
        public string TakeOffAirport { get; set; } = string.Empty;
        public string LandingAirport { get; set; } = string.Empty;
        public DateTime TakeOffDateTime { get; set; }
        public string Status { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public TimeSpan FlightTime { get; set; }
        public int Distance { get; set; }
        public int Transfers { get; set; }
        public string? PlaneImage { get; set; }
        public string? AirlineImage { get; set; }
    }
}
