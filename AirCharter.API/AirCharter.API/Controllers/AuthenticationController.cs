using AirCharter.API.Model;
using AirCharter.API.Requests.Authentication;
using AirCharter.API.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text;
using System.Security.Cryptography;

namespace AirCharter.API.Controllers;

[ApiController]
[Route("auth")]
public sealed class AuthController(AirCharterExtendedContext context, JwtService jwtService, EmailService emailService) : ControllerBase
{
    private const int ClientRoleId = 1;
    private const int RefreshTokenLifetimeDays = 30;
    private const string RefreshTokenCookieName = "refreshToken";

    private readonly AirCharterExtendedContext _context = context;
    private readonly JwtService _jwtService = jwtService;
    private readonly EmailService _emailService = emailService;
    private readonly PasswordHasher<User> _passwordHasher = new();

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest("Email is required.");

        if (string.IsNullOrWhiteSpace(request.Password))
            return BadRequest("Password is required.");

        User? existingUser = await _context.Users.FirstOrDefaultAsync(user => user.Email == request.Email, cancellationToken);

        if (existingUser != null)
            return Conflict("User with this email already exists.");

        User user = new()
        {
            RoleId = ClientRoleId,
            Email = request.Email,
            IsEmailConfirmed = false,
            IsActive = true
        };

        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
        string confirmationCode = SetEmailConfirmationCode(user);

        _context.Users.Add(user);
        await _context.SaveChangesAsync(cancellationToken);

        await _emailService.SendHtmlMessageAsync(user.Email, "Подтверждение почты",
            $"<h3>Код подтверждения</h3><p>Ваш код: <b>{confirmationCode}</b></p><p>Код действует 10 минут.</p>",
            cancellationToken);

        return NoContent();
    }

    [HttpPost("confirm-email")]
    public async Task<IActionResult> ConfirmEmail([FromBody] ConfirmEmailRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest("Email is required.");

        if (string.IsNullOrWhiteSpace(request.Code))
            return BadRequest("Code is required.");

        User? user = await _context.Users
            .Include(currentUser => currentUser.Role)
            .FirstOrDefaultAsync(currentUser => currentUser.Email == request.Email, cancellationToken);

        if (user == null)
            return NotFound("User not found.");

        if (user.IsEmailConfirmed)
            return BadRequest("Email is already confirmed.");

        if (string.IsNullOrWhiteSpace(user.EmailConfirmationCodeHash))
            return BadRequest("Confirmation code not found.");

        if (user.EmailConfirmationCodeExpiresAtUtc == null)
            return BadRequest("Confirmation code expiration not found.");

        if (user.EmailConfirmationCodeExpiresAtUtc.Value < DateTime.UtcNow)
            return BadRequest("Confirmation code expired.");

        bool isConfirmationCodeValid = IsConfirmationCodeValid(user, request.Code);

        if (!isConfirmationCodeValid)
            return BadRequest("Invalid confirmation code.");

        user.IsEmailConfirmed = true;
        user.EmailConfirmationCodeHash = null;
        user.EmailConfirmationCodeExpiresAtUtc = null;

        await _context.SaveChangesAsync(cancellationToken);

        await IssueRefreshTokenAsync(user, cancellationToken);

        string token = _jwtService.GenerateAccessToken(user.Id, user.Role.Name);

        return Ok(new AccessTokenResponse
        {
            Token = token
        });
    }

    [HttpPost("resend-email-confirmation-code")]
    public async Task<IActionResult> ResendEmailConfirmationCode([FromBody] ResendEmailConfirmationCodeRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest("Email is required.");

        User? user = await _context.Users.FirstOrDefaultAsync(currentUser => currentUser.Email == request.Email, cancellationToken);

        if (user == null)
            return NotFound("User not found.");

        if (user.IsEmailConfirmed)
            return BadRequest("Email is already confirmed.");

        string confirmationCode = SetEmailConfirmationCode(user);

        await _context.SaveChangesAsync(cancellationToken);

        await _emailService.SendHtmlMessageAsync(user.Email, "Новый код подтверждения",
            $"<h3>Код подтверждения</h3><p>Ваш код: <b>{confirmationCode}</b></p><p>Код действует 10 минут.</p>",
            cancellationToken);

        return NoContent();
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest("Email is required.");

        if (string.IsNullOrWhiteSpace(request.Password))
            return BadRequest("Password is required.");

        User? user = await _context.Users
            .Include(currentUser => currentUser.Role)
            .FirstOrDefaultAsync(currentUser => currentUser.Email == request.Email, cancellationToken);

        if (user == null)
            return Unauthorized();

        if (!user.IsActive)
            return Forbid();

        if (!user.IsEmailConfirmed)
            return BadRequest("Email is not confirmed.");

        PasswordVerificationResult passwordVerificationResult = 
            _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);

        if (passwordVerificationResult == PasswordVerificationResult.Failed)
            return Unauthorized();

        await IssueRefreshTokenAsync(user, cancellationToken);

        string token = _jwtService.GenerateAccessToken(user.Id, user.Role.Name);

        return Ok(new AccessTokenResponse
        {
            Token = token
        });
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh(CancellationToken cancellationToken)
    {
        string? refreshTokenValue = Request.Cookies[RefreshTokenCookieName];

        if (string.IsNullOrWhiteSpace(refreshTokenValue))
            return Unauthorized();

        string refreshTokenHash = HashRefreshToken(refreshTokenValue);

        RefreshToken? refreshToken = await _context.RefreshTokens
            .Include(currentRefreshToken => currentRefreshToken.User)
            .ThenInclude(user => user.Role)
            .FirstOrDefaultAsync(currentRefreshToken => currentRefreshToken.TokenHash == refreshTokenHash, cancellationToken);

        if (refreshToken == null)
        {
            ClearRefreshTokenCookie();
            return Unauthorized();
        }

        if (refreshToken.RevokedAtUtc != null || refreshToken.ExpiresAtUtc <= DateTime.UtcNow)
        {
            ClearRefreshTokenCookie();
            return Unauthorized();
        }

        if (!refreshToken.User.IsActive || !refreshToken.User.IsEmailConfirmed)
        {
            ClearRefreshTokenCookie();
            return Unauthorized();
        }

        string nextRefreshTokenValue = GenerateRefreshTokenValue();
        RefreshToken nextRefreshToken = CreateRefreshToken(refreshToken.UserId, nextRefreshTokenValue);

        await using Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction transaction =
            await _context.Database.BeginTransactionAsync(cancellationToken);

        _context.RefreshTokens.Add(nextRefreshToken);
        await _context.SaveChangesAsync(cancellationToken);

        refreshToken.RevokedAtUtc = DateTime.UtcNow;
        refreshToken.ReplacedByTokenId = nextRefreshToken.Id;

        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        SetRefreshTokenCookie(nextRefreshTokenValue, nextRefreshToken.ExpiresAtUtc);

        string accessToken = _jwtService.GenerateAccessToken(refreshToken.User.Id, refreshToken.User.Role.Name);

        return Ok(new AccessTokenResponse
        {
            Token = accessToken
        });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        string? refreshTokenValue = Request.Cookies[RefreshTokenCookieName];

        if (!string.IsNullOrWhiteSpace(refreshTokenValue))
        {
            string refreshTokenHash = HashRefreshToken(refreshTokenValue);

            RefreshToken? refreshToken = await _context.RefreshTokens
                .FirstOrDefaultAsync(currentRefreshToken =>
                    currentRefreshToken.TokenHash == refreshTokenHash &&
                    currentRefreshToken.RevokedAtUtc == null,
                    cancellationToken);

            if (refreshToken != null)
            {
                refreshToken.RevokedAtUtc = DateTime.UtcNow;
                await _context.SaveChangesAsync(cancellationToken);
            }
        }

        ClearRefreshTokenCookie();

        return NoContent();
    }

    private string SetEmailConfirmationCode(User user)
    {
        string confirmationCode = GenerateEmailConfirmationCode();

        user.EmailConfirmationCodeHash = _passwordHasher.HashPassword(user, confirmationCode);
        user.EmailConfirmationCodeExpiresAtUtc = DateTime.UtcNow.AddMinutes(10);

        return confirmationCode;
    }

    private bool IsConfirmationCodeValid(User user, string confirmationCode) =>
        _passwordHasher.VerifyHashedPassword(user, user.EmailConfirmationCodeHash!, confirmationCode) 
        != PasswordVerificationResult.Failed;

    private async Task IssueRefreshTokenAsync(User user, CancellationToken cancellationToken)
    {
        string refreshTokenValue = GenerateRefreshTokenValue();
        RefreshToken refreshToken = CreateRefreshToken(user.Id, refreshTokenValue);

        _context.RefreshTokens.Add(refreshToken);
        await _context.SaveChangesAsync(cancellationToken);

        SetRefreshTokenCookie(refreshTokenValue, refreshToken.ExpiresAtUtc);
    }

    private static RefreshToken CreateRefreshToken(int userId, string refreshTokenValue)
    {
        return new RefreshToken
        {
            UserId = userId,
            TokenHash = HashRefreshToken(refreshTokenValue),
            CreatedAtUtc = DateTime.UtcNow,
            ExpiresAtUtc = DateTime.UtcNow.AddDays(RefreshTokenLifetimeDays)
        };
    }

    private void SetRefreshTokenCookie(string refreshTokenValue, DateTime expiresAtUtc)
    {
        Response.Cookies.Append(RefreshTokenCookieName, refreshTokenValue, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.None,
            Expires = expiresAtUtc,
            Path = "/auth"
        });
    }

    private void ClearRefreshTokenCookie()
    {
        Response.Cookies.Delete(RefreshTokenCookieName, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.None,
            Path = "/auth"
        });
    }

    private static string GenerateRefreshTokenValue()
    {
        return WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(64));
    }

    private static string HashRefreshToken(string refreshTokenValue)
    {
        byte[] tokenBytes = Encoding.UTF8.GetBytes(refreshTokenValue);
        byte[] tokenHash = SHA256.HashData(tokenBytes);

        return Convert.ToBase64String(tokenHash);
    }

    private static string GenerateEmailConfirmationCode() => RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
}
