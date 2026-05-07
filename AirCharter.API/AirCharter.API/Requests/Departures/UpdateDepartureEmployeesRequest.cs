namespace AirCharter.API.Requests.Departures;

public sealed class UpdateDepartureEmployeesRequest
{
    public IReadOnlyCollection<int> EmployeeIds { get; set; } = Array.Empty<int>();
}
