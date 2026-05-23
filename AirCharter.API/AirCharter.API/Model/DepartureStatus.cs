using System;
using System.Collections.Generic;

namespace AirCharter.API.Model;

public partial class DepartureStatus
{
    public int Id { get; set; }

    public int DepartureId { get; set; }

    public int StatusId { get; set; }

    public DateTime StatusSettingDateTime { get; set; }

    public int? DelayMinutes { get; set; }

    public int? RedirectedAirportId { get; set; }

    public virtual Departure Departure { get; set; } = null!;

    public virtual Airport? RedirectedAirport { get; set; }

    public virtual Status Status { get; set; } = null!;
}
