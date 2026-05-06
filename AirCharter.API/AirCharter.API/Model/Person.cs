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

    public string? RegistrationAddress { get; set; }

    public string? ActualAddress { get; set; }

    public string? PhoneNumber { get; set; }

    public string? TaxpayerId { get; set; }

    public string? BankName { get; set; }

    public string? CurrentAccountNumber { get; set; }

    public string? CorrespondentAccountNumber { get; set; }

    public string? BankIdentifierCode { get; set; }

    public virtual ICollection<User> Users { get; set; } = new List<User>();

    public virtual ICollection<Departure> Departures { get; set; } = new List<Departure>();
}
