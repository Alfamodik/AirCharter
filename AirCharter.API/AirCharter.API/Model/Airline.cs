using System;
using System.Collections.Generic;

namespace AirCharter.API.Model;

public partial class Airline
{
    public int Id { get; set; }

    public int BankDetailsId { get; set; }

    public string AirlineName { get; set; } = null!;

    public DateOnly CreationDate { get; set; }

    public string OrganizationFullName { get; set; } = null!;

    public string OrganizationShortName { get; set; } = null!;

    public string LegalAddress { get; set; } = null!;

    public string PostalAddress { get; set; } = null!;

    public string PhoneNumber { get; set; } = null!;

    public string Email { get; set; } = null!;

    public byte[]? Image { get; set; }

    public virtual BankDetail BankDetails { get; set; } = null!;

    public virtual ICollection<Employee> Employees { get; set; } = new List<Employee>();

    public virtual ICollection<Plane> Planes { get; set; } = new List<Plane>();
}
