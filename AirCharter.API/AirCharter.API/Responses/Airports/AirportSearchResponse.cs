namespace AirCharter.API.Responses.Airports;

public sealed class AirportSearchResponse
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? City { get; set; }

    public string Country { get; set; } = string.Empty;

    public string? Iata { get; set; }

    public string? Icao { get; set; }

    public decimal Latitude { get; set; }

    public decimal Longitude { get; set; }
}