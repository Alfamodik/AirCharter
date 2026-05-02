namespace AirCharter.API.Responses.Departures;

public sealed class ManagementRouteCandidateResponse
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? City { get; set; }

    public string Country { get; set; } = string.Empty;

    public string? Iata { get; set; }

    public string? Icao { get; set; }

    public decimal Latitude { get; set; }

    public decimal Longitude { get; set; }

    public int DistanceFromCurrentKm { get; set; }

    public int DistanceToDestinationKm { get; set; }

    public int PriorityScore { get; set; }

    public bool IsCapital { get; set; }

    public bool IsLargeCity { get; set; }

    public bool IsBestSystemChoice { get; set; }
}
