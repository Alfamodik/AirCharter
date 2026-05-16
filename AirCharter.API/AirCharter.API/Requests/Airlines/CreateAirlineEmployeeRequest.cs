namespace AirCharter.API.Requests.Airlines;

public sealed class CreateAirlineEmployeeRequest
{
    public string Email { get; set; } = string.Empty;

    public string RoleName { get; set; } = "Employee";
}
