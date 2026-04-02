using System;
using System.Collections.Generic;

namespace AirCharter.API.Model;

public partial class Status
{
    public int Id { get; set; }

    public string Status1 { get; set; } = null!;

    public virtual ICollection<DepartureStatus> DepartureStatuses { get; set; } = new List<DepartureStatus>();
}
