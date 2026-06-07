// DTO ответа AccessTokenResponse описывает JWT-токен, который API возвращает frontend после входа или обновления сессии.

namespace AirCharter.API.Requests.Authentication
{
    public sealed class AccessTokenResponse
    {
        public string Token { get; set; } = string.Empty;
    }
}
