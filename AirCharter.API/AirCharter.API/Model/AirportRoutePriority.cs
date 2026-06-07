// Модель AirportRoutePriority описывает таблицу базы данных и связи, которые EF Core использует при чтении и сохранении данных.

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
