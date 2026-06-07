// DTO запроса UpdateAirlineImageRequest описывает данные, которые frontend отправляет в API для выполнения операции.

namespace AirCharter.API.Requests.Airlines;

public sealed class UpdateAirlineImageRequest
{
    public string? ImageBase64 { get; set; }
}
