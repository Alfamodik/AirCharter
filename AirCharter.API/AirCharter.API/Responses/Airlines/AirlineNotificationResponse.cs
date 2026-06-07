// DTO ответа AirlineNotificationResponse описывает данные, которые API возвращает frontend после обработки запроса.

namespace AirCharter.API.Responses.Airlines;

public sealed class AirlineNotificationResponse
{
    public int Id { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;

    public DateTime CreatedAtUtc { get; set; }

    public DateTime? ReadAtUtc { get; set; }
}
