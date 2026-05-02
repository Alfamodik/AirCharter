using System;

namespace AirCharter.API.Model;

public partial class AirportRoutePriority
{
    public int AirportId { get; set; }

    public int PriorityScore { get; set; }

    public bool IsCapital { get; set; }

    public bool IsLargeCity { get; set; }

    public string? Note { get; set; }

    public virtual Airport Airport { get; set; } = null!;
}
