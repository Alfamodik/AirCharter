namespace AirCharter.API.Responses.Airlines;

public sealed class CreateAirlineEmployeeResponse
{
    public AirlineEmployeeResponse? Employee { get; set; }

    public bool NotificationCreated { get; set; }

    public string Message { get; set; } = string.Empty;
}
