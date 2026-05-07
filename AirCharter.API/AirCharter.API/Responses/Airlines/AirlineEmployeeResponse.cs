namespace AirCharter.API.Responses.Airlines;

public sealed class AirlineEmployeeResponse
{
    public int Id { get; set; }

    public string Email { get; set; } = string.Empty;

    public string RoleName { get; set; } = string.Empty;

    public string? FullName { get; set; }
}
