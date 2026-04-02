using System;
using System.Collections.Generic;

namespace AirCharter.API.Model;

public partial class DepartureEmployee
{
    public int Id { get; set; }

    public int DepartureId { get; set; }

    public int EmployeeId { get; set; }

    public virtual Departure Departure { get; set; } = null!;

    public virtual Employee Employee { get; set; } = null!;
}
