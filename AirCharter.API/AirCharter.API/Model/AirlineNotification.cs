namespace AirCharter.API.Model;

public partial class AirlineNotification
{
    public int Id { get; set; }

    public int AirlineId { get; set; }

    public string Title { get; set; } = null!;

    public string Message { get; set; } = null!;

    public DateTime CreatedAtUtc { get; set; }

    public DateTime? ReadAtUtc { get; set; }

    public virtual Airline Airline { get; set; } = null!;
}
