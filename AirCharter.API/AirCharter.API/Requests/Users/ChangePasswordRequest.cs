// DTO запроса ChangePasswordRequest описывает данные, которые frontend отправляет в API для выполнения операции.

namespace AirCharter.API.Requests.Users;

public sealed class ChangePasswordRequest
{
    public string CurrentPassword { get; set; } = string.Empty;

    public string NewPassword { get; set; } = string.Empty;
}
