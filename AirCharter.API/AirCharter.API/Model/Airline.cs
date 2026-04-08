using System;
using System.Collections.Generic;

namespace AirCharter.API.Model;

public partial class Airline
{
    public int Id { get; set; }

    public string AirlineName { get; set; } = null!;

    public DateOnly CreationDate { get; set; }

    public string OrganizationFullName { get; set; } = null!;

    public string OrganizationShortName { get; set; } = null!;

    public string LegalAddress { get; set; } = null!;

    public string PostalAddress { get; set; } = null!;

    public string PhoneNumber { get; set; } = null!;

    public string Email { get; set; } = null!;

    public string BankName { get; set; } = null!;

    public string TaxpayerId { get; set; } = null!;

    public string TaxRegistrationReasonCode { get; set; } = null!;

    public string PrimaryStateRegistrationNumber { get; set; } = null!;

    public string CurrentAccountNumber { get; set; } = null!;

    public string CorrespondentAccountNumber { get; set; } = null!;

    public string BankIdentifierCode { get; set; } = null!;

    public byte[]? Image { get; set; }

    public virtual ICollection<Plane> Planes { get; set; } = new List<Plane>();

    public virtual ICollection<User> Users { get; set; } = new List<User>();
}
