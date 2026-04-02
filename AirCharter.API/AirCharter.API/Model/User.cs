using System;
using System.Collections.Generic;

namespace AirCharter.API.Model;

public partial class User
{
    public int Id { get; set; }

    public int? PersonId { get; set; }

    public int RoleId { get; set; }

    public int? BankDetailsId { get; set; }

    public string Email { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;

    public string? LegalAddress { get; set; }

    public string? ActualAddress { get; set; }

    public string? EmailConfirmationCodeHash { get; set; }

    public DateTime? EmailConfirmationCodeExpiresAtUtc { get; set; }

    public bool IsEmailConfirmed { get; set; }

    public bool IsActive { get; set; }

    public virtual BankDetail? BankDetails { get; set; }

    public virtual ICollection<Departure> Departures { get; set; } = new List<Departure>();

    public virtual Person? Person { get; set; }

    public virtual Role Role { get; set; } = null!;
}
