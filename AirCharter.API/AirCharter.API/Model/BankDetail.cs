using System;
using System.Collections.Generic;

namespace AirCharter.API.Model;

public partial class BankDetail
{
    public int Id { get; set; }

    public string BankName { get; set; } = null!;

    public string TaxpayerId { get; set; } = null!;

    public string TaxRegistrationReasonCode { get; set; } = null!;

    public string PrimaryStateRegistrationNumber { get; set; } = null!;

    public string CurrentAccountNumber { get; set; } = null!;

    public string CorrespondentAccountNumber { get; set; } = null!;

    public string BankIdentifierCode { get; set; } = null!;

    public virtual ICollection<Airline> Airlines { get; set; } = new List<Airline>();

    public virtual ICollection<User> Users { get; set; } = new List<User>();
}
