// DTO запроса UpdateAirlineEmployeeRoleRequest описывает данные, которые frontend отправляет в API для выполнения операции.

namespace AirCharter.API.Requests.Airlines;

public sealed class UpdateAirlineEmployeeRoleRequest
{
    public string RoleName { get; set; } = string.Empty;
}
