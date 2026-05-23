using System.Collections.Concurrent;
using AirCharter.API.Model;
using GeoTimeZone;
using TimeZoneConverter;

namespace AirCharter.API.Services;

public sealed class AirportTimeZoneService
{
    private readonly ConcurrentDictionary<string, TimeZoneInfo> _timeZonesByCoordinate = new();

    public DateTime CalculateArrivalDateTime(
        DateTime departureDateTime,
        TimeSpan flightTime,
        Airport takeOffAirport,
        Airport landingAirport)
    {
        return CalculateArrivalDateTime(
            departureDateTime,
            flightTime,
            takeOffAirport.Latitude,
            takeOffAirport.Longitude,
            landingAirport.Latitude,
            landingAirport.Longitude);
    }

    public DateTime CalculateArrivalDateTime(
        DateTime departureDateTime,
        TimeSpan flightTime,
        decimal takeOffLatitude,
        decimal takeOffLongitude,
        decimal landingLatitude,
        decimal landingLongitude)
    {
        DateTimeOffset departureInstant = CreateDepartureInstant(
            departureDateTime,
            takeOffLatitude,
            takeOffLongitude);
        TimeZoneInfo landingTimeZone = GetTimeZone(landingLatitude, landingLongitude);
        DateTime arrivalDateTime = TimeZoneInfo
            .ConvertTime(departureInstant.Add(flightTime), landingTimeZone)
            .DateTime;

        return DateTime.SpecifyKind(arrivalDateTime, DateTimeKind.Unspecified);
    }

    public DateTimeOffset CreateDepartureInstant(DateTime departureDateTime, Airport takeOffAirport)
    {
        return CreateDepartureInstant(
            departureDateTime,
            takeOffAirport.Latitude,
            takeOffAirport.Longitude);
    }

    public DateTimeOffset CreateDepartureInstant(
        DateTime departureDateTime,
        decimal takeOffLatitude,
        decimal takeOffLongitude)
    {
        DateTime localDepartureDateTime = DateTime.SpecifyKind(
            departureDateTime,
            DateTimeKind.Unspecified);
        TimeZoneInfo takeOffTimeZone = GetTimeZone(takeOffLatitude, takeOffLongitude);

        return new DateTimeOffset(
            localDepartureDateTime,
            takeOffTimeZone.GetUtcOffset(localDepartureDateTime));
    }

    private TimeZoneInfo GetTimeZone(decimal latitude, decimal longitude)
    {
        string key = $"{Math.Round(latitude, 6)}:{Math.Round(longitude, 6)}";

        return _timeZonesByCoordinate.GetOrAdd(
            key,
            _ => ResolveTimeZone(latitude, longitude));
    }

    private static TimeZoneInfo ResolveTimeZone(decimal latitude, decimal longitude)
    {
        string? ianaTimeZoneId = TimeZoneLookup
            .GetTimeZone(Convert.ToDouble(latitude), Convert.ToDouble(longitude))
            .Result;

        if (string.IsNullOrWhiteSpace(ianaTimeZoneId))
            throw new InvalidOperationException(
                $"Could not resolve a time zone for coordinates {latitude}, {longitude}.");

        return TZConvert.GetTimeZoneInfo(ianaTimeZoneId);
    }
}
