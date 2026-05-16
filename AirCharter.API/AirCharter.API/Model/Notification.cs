namespace AirCharter.API.Model;

public partial class Notification
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public string Title { get; set; } = null!;

    public string Message { get; set; } = null!;

    public string? ActionType { get; set; }

    public int? AirlineId { get; set; }

    public int? RoleId { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime? ReadAtUtc { get; set; }

    public virtual Airline? Airline { get; set; }

    public virtual Role? Role { get; set; }

    public virtual User User { get; set; } = null!;
}
