using System;
using System.Collections.Generic;

namespace AirCharter.API.Model;

public partial class Plane
{
    public int Id { get; set; }

    public int AirlineId { get; set; }

    public string ModelName { get; set; } = null!;

    public int MaxDistance { get; set; }

    public int PassangerCapacity { get; set; }

    public int CruisingSpeed { get; set; }

    public int CostPerKilometer { get; set; }

    public int FlightHourCost { get; set; }

    public byte[]? Image { get; set; }

    public virtual Airline Airline { get; set; } = null!;

    public virtual ICollection<Departure> Departures { get; set; } = new List<Departure>();
}
