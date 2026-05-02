using System;
using System.Collections.Generic;

namespace AirCharter.API.Model;

public partial class DepartureRouteLeg
{
    public int Id { get; set; }

    public int DepartureId { get; set; }

    public int SequenceNumber { get; set; }

    public int FromAirportId { get; set; }

    public int ToAirportId { get; set; }

    public int Distance { get; set; }

    public TimeSpan FlightTime { get; set; }

    public decimal FlightCost { get; set; }

    public TimeSpan? GroundTimeAfterArrival { get; set; }

    public virtual Departure Departure { get; set; } = null!;

    public virtual Airport FromAirport { get; set; } = null!;

    public virtual Airport ToAirport { get; set; } = null!;
}
