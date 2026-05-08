namespace AirCharter.API.Requests.Planes;

public sealed class SavePlaneRequest
{
    public string? ModelName { get; set; }

    public int MaxDistance { get; set; }

    public int PassengerCapacity { get; set; }

    public int CruisingSpeed { get; set; }

    public decimal FlightHourCost { get; set; }

    public string? ImageBase64 { get; set; }
}
