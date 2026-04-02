using System;
using System.Collections.Generic;

namespace AirCharter.API.Model;

public partial class Employee
{
    public int Id { get; set; }

    public int PersonId { get; set; }

    public int PositionId { get; set; }

    public int AirlineId { get; set; }

    public virtual Airline Airline { get; set; } = null!;

    public virtual ICollection<DepartureEmployee> DepartureEmployees { get; set; } = new List<DepartureEmployee>();

    public virtual Person Person { get; set; } = null!;

    public virtual Position Position { get; set; } = null!;
}
