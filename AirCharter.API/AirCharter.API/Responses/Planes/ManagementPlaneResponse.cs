namespace AirCharter.API.Responses.Planes;

public sealed class ManagementPlaneResponse
{
    public int Id { get; set; }

    public string ModelName { get; set; } = string.Empty;

    public int MaxDistance { get; set; }

    public int PassengerCapacity { get; set; }

    public int CruisingSpeed { get; set; }

    public decimal FlightHourCost { get; set; }

    public string? ImageBase64 { get; set; }
}
