using AirCharter.API.Model;
using AirCharter.API.Responses.Flights;

namespace AirCharter.API.Services;

public sealed class FlightCalculationService
{
    private const double EarthRadiusKilometers = 6371.0;
    private const double TransferDurationHours = 1.5;
    private const decimal TransferExtraCost = 50000m;

    public PlaneCatalogResponse Calculate(Plane plane, Airport departureAirport, Airport arrivalAirport)
    {
        int distanceKilometers = CalculateDistanceKilometers(
            Convert.ToDouble(departureAirport.Latitude),
            Convert.ToDouble(departureAirport.Longitude),
            Convert.ToDouble(arrivalAirport.Latitude),
            Convert.ToDouble(arrivalAirport.Longitude));

        int numberOfTransfers = CalculateNumberOfTransfers(
            distanceKilometers,
            plane.MaxDistance);

        TimeSpan flightTime = CalculateFlightTime(
            distanceKilometers,
            plane.CruisingSpeed,
            numberOfTransfers);

        decimal flightCost = CalculateFlightCost(
            distanceKilometers,
            plane.CostPerKilometer,
            numberOfTransfers);

        return new PlaneCatalogResponse
        {
            Id = plane.Id,
            ModelName = plane.ModelName,
            PassengerCapacity = plane.PassangerCapacity,
            MaxDistance = plane.MaxDistance,
            DistanceKm = distanceKilometers,
            FlightTime = flightTime,
            FlightCost = decimal.Round(flightCost, 0),
            NumberOfTransfers = numberOfTransfers,
            ImageBase64 = ConvertImageToBase64(plane.Image)
        };
    }

    private static int CalculateDistanceKilometers(
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

        double a =
            Math.Sin(latitudeDifference / 2) * Math.Sin(latitudeDifference / 2) +
            Math.Cos(departureLatitudeRadians) *
            Math.Cos(arrivalLatitudeRadians) *
            Math.Sin(longitudeDifference / 2) *
            Math.Sin(longitudeDifference / 2);

        double c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));

        return (int)Math.Round(EarthRadiusKilometers * c);
    }

    private static double DegreesToRadians(double degrees)
    {
        return degrees * Math.PI / 180.0;
    }

    private static int CalculateNumberOfTransfers(int distanceKilometers, int maxDistance)
    {
        if (maxDistance <= 0)
        {
            return 0;
        }

        if (distanceKilometers <= maxDistance)
        {
            return 0;
        }

        return (int)Math.Ceiling((double)distanceKilometers / maxDistance) - 1;
    }

    private static TimeSpan CalculateFlightTime(
        int distanceKilometers,
        int cruisingSpeed,
        int numberOfTransfers)
    {
        if (cruisingSpeed <= 0)
        {
            return TimeSpan.Zero;
        }

        double flightDurationHours = (double)distanceKilometers / cruisingSpeed;
        double transferDurationHours = numberOfTransfers * TransferDurationHours;

        return TimeSpan.FromHours(flightDurationHours + transferDurationHours);
    }

    private static decimal CalculateFlightCost(
        int distanceKilometers,
        int costPerKilometer,
        int numberOfTransfers)
    {
        decimal baseFlightCost = distanceKilometers * costPerKilometer;
        decimal transferCost = numberOfTransfers * TransferExtraCost;

        return baseFlightCost + transferCost;
    }

    private static string? ConvertImageToBase64(byte[]? image)
    {
        if (image is null || image.Length == 0)
        {
            return null;
        }

        return Convert.ToBase64String(image);
    }
}