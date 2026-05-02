using System;
using System.Collections.Generic;

namespace AirCharter.API.Model;

public partial class RefreshToken
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public string TokenHash { get; set; } = null!;

    public DateTime CreatedAtUtc { get; set; }

    public DateTime ExpiresAtUtc { get; set; }

    public DateTime? RevokedAtUtc { get; set; }

    public int? ReplacedByTokenId { get; set; }

    public virtual RefreshToken? ReplacedByToken { get; set; }

    public virtual ICollection<RefreshToken> ReplacedRefreshTokens { get; set; } = new List<RefreshToken>();

    public virtual User User { get; set; } = null!;
}
