namespace AirCharter.API.Services.Routing;

public sealed class AirportRouteNode
{
    public AirportRouteNode(
        int id,
        string name,
        string? city,
        string country,
        string? iata,
        string? icao,
        decimal latitude,
        decimal longitude)
    {
        Id = id;
        Name = name;
        City = city;
        Country = country;
        Iata = iata;
        Icao = icao;
        Latitude = latitude;
        Longitude = longitude;

        double latitudeDouble = Convert.ToDouble(latitude);
        double longitudeDouble = Convert.ToDouble(longitude);

        LatitudeDouble = latitudeDouble;
        LongitudeDouble = longitudeDouble;
        LatitudeRadians = GeoDistanceCalculator.DegreesToRadians(latitudeDouble);
        LongitudeRadians = GeoDistanceCalculator.DegreesToRadians(longitudeDouble);
    }

    public int Id { get; }

    public string Name { get; }

    public string? City { get; }

    public string Country { get; }

    public string? Iata { get; }

    public string? Icao { get; }

    public decimal Latitude { get; }

    public decimal Longitude { get; }

    public double LatitudeDouble { get; }

    public double LongitudeDouble { get; }

    public double LatitudeRadians { get; }

    public double LongitudeRadians { get; }
}