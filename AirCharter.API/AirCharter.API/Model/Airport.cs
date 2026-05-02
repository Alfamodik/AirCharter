using System;
using System.Collections.Generic;

namespace AirCharter.API.Model;

public partial class Airport
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    public string? City { get; set; }

    public string Country { get; set; } = null!;

    public string? Iata { get; set; }

    public string? Icao { get; set; }

    public decimal Latitude { get; set; }

    public decimal Longitude { get; set; }

    public virtual ICollection<Departure> DepartureLandingAirports { get; set; } = new List<Departure>();

    public virtual ICollection<DepartureRouteLeg> DepartureRouteLegFromAirports { get; set; } = new List<DepartureRouteLeg>();

    public virtual ICollection<DepartureRouteLeg> DepartureRouteLegToAirports { get; set; } = new List<DepartureRouteLeg>();

    public virtual ICollection<Departure> DepartureTakeOffAirports { get; set; } = new List<Departure>();
}
