using System;
using System.Collections.Generic;

namespace AirCharter.API.Model;

public partial class Person
{
    public int Id { get; set; }

    public string FirstName { get; set; } = null!;

    public string LastName { get; set; } = null!;

    public string? Patronymic { get; set; }

    public string PassportSeries { get; set; } = null!;

    public string PassportNumber { get; set; } = null!;

    public string? Email { get; set; }

    public DateOnly? BirthDate { get; set; }

    public virtual ICollection<User> Users { get; set; } = new List<User>();

    public virtual ICollection<Departure> Departures { get; set; } = new List<Departure>();
}
