namespace AirCharter.API.Services.Routing;

public static class GeoDistanceCalculator
{
    private const double EarthRadiusKilometers = 6371.0;

    public static int CalculateDistanceKilometers(
        AirportRouteNode departureAirport,
        AirportRouteNode arrivalAirport)
    {
        double latitudeDifference = arrivalAirport.LatitudeRadians - departureAirport.LatitudeRadians;
        double longitudeDifference = arrivalAirport.LongitudeRadians - departureAirport.LongitudeRadians;

        double haversineValue =
            Math.Sin(latitudeDifference / 2) * Math.Sin(latitudeDifference / 2) +
            Math.Cos(departureAirport.LatitudeRadians) *
            Math.Cos(arrivalAirport.LatitudeRadians) *
            Math.Sin(longitudeDifference / 2) *
            Math.Sin(longitudeDifference / 2);

        double angularDistance = 2 * Math.Atan2(
            Math.Sqrt(haversineValue),
            Math.Sqrt(1 - haversineValue));

        return (int)Math.Round(EarthRadiusKilometers * angularDistance);
    }

    public static int CalculateDistanceKilometers(
        double departureLatitude,
        double departureLongitude,
        double arrivalLatitude,
        double arrivalLongitude)
    {
        double departureLatitudeRadians = DegreesToRadians(departureLatitude);
        double departureLongitudeRadians = DegreesToRadians(departureLongitude);
        double arrivalLatitudeRadians = DegreesToRadians(arrivalLatitude);
        double arrivalLongitudeRadians = DegreesToRadians(arrivalLongitude);

        double latitudeDifference = arrivalLatitudeRadians - departureLatitudeRadians;
        double longitudeDifference = arrivalLongitudeRadians - departureLongitudeRadians;

        double haversineValue =
            Math.Sin(latitudeDifference / 2) * Math.Sin(latitudeDifference / 2) +
            Math.Cos(departureLatitudeRadians) *
            Math.Cos(arrivalLatitudeRadians) *
            Math.Sin(longitudeDifference / 2) *
            Math.Sin(longitudeDifference / 2);

        double angularDistance = 2 * Math.Atan2(
            Math.Sqrt(haversineValue),
            Math.Sqrt(1 - haversineValue));

        return (int)Math.Round(EarthRadiusKilometers * angularDistance);
    }

    public static double DegreesToRadians(double degrees)
    {
        return degrees * Math.PI / 180.0;
    }
}