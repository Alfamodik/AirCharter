namespace AirCharter.API.Responses.Users;

public sealed class NotificationResponse
{
    public int Id { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;

    public string? ActionType { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime? ReadAtUtc { get; set; }
}
