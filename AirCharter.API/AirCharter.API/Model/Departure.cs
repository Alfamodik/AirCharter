using System;
using System.Collections.Generic;

namespace AirCharter.API.Model;

public partial class Departure
{
    public int Id { get; set; }

    public int CharterRequesterId { get; set; }

    public int PlaneId { get; set; }

    public int TakeOffAirportId { get; set; }

    public int LandingAirportId { get; set; }

    public int Distance { get; set; }

    public TimeSpan FlightTime { get; set; }

    public decimal Price { get; set; }

    public int Transfers { get; set; }

    public DateTime RequestedTakeOffDateTime { get; set; }

    public virtual User CharterRequester { get; set; } = null!;

    public virtual ICollection<DepartureRouteLeg> DepartureRouteLegs { get; set; } = new List<DepartureRouteLeg>();

    public virtual ICollection<DepartureStatus> DepartureStatuses { get; set; } = new List<DepartureStatus>();

    public virtual Airport LandingAirport { get; set; } = null!;

    public virtual Plane Plane { get; set; } = null!;

    public virtual Airport TakeOffAirport { get; set; } = null!;

    public virtual ICollection<User> Employees { get; set; } = new List<User>();

    public virtual ICollection<Person> People { get; set; } = new List<Person>();
}
