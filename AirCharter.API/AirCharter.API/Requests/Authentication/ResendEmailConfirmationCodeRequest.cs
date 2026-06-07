// DTO запроса ResendEmailConfirmationCodeRequest описывает данные, которые frontend отправляет в API для выполнения операции.

namespace AirCharter.API.Requests.Authentication
{
    public sealed class ResendEmailConfirmationCodeRequest
    {
        public string Email { get; set; } = string.Empty;
    }
}
