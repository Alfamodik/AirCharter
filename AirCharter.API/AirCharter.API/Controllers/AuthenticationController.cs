using AirCharter.API.Model;
using AirCharter.API.Requests;
using AirCharter.API.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;

namespace AirCharter.API.Controllers;

[ApiController]
[Route("auth")]
public sealed class AuthController(AirCharterExtendedContext context, JwtService jwtService, EmailService emailService) : ControllerBase
{
    private const int ClientRoleId = 1;

    private readonly AirCharterExtendedContext _context = context;
    private readonly JwtService _jwtService = jwtService;
    private readonly EmailService _emailService = emailService;
    private readonly PasswordHasher<User> _passwordHasher = new();

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken cancellationToken)
    {
        string email = NormalizeEmail(request.Email);

        if (string.IsNullOrWhiteSpace(email))
            return BadRequest("Email is required.");

        if (string.IsNullOrWhiteSpace(request.Password))
            return BadRequest("Password is required.");

        User? existingUser = await _context.Users.FirstOrDefaultAsync(user => user.Email == email, cancellationToken);

        if (existingUser != null)
            return Conflict("User with this email already exists.");

        User user = new()
        {
            RoleId = ClientRoleId,
            Email = email,
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
        string email = NormalizeEmail(request.Email);

        if (string.IsNullOrWhiteSpace(email))
            return BadRequest("Email is required.");

        if (string.IsNullOrWhiteSpace(request.Code))
            return BadRequest("Code is required.");

        User? user = await _context.Users
            .Include(currentUser => currentUser.Role)
            .FirstOrDefaultAsync(currentUser => currentUser.Email == email, cancellationToken);

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

        string token = _jwtService.GenerateAccessToken(user.Id, user.Role.Name);

        return Ok(new AccessTokenResponse
        {
            Token = token
        });
    }

    [HttpPost("resend-email-confirmation-code")]
    public async Task<IActionResult> ResendEmailConfirmationCode([FromBody] ResendEmailConfirmationCodeRequest request, CancellationToken cancellationToken)
    {
        string email = NormalizeEmail(request.Email);

        if (string.IsNullOrWhiteSpace(email))
            return BadRequest("Email is required.");

        User? user = await _context.Users.FirstOrDefaultAsync(currentUser => currentUser.Email == email, cancellationToken);

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
        string email = NormalizeEmail(request.Email);

        if (string.IsNullOrWhiteSpace(email))
            return BadRequest("Email is required.");

        if (string.IsNullOrWhiteSpace(request.Password))
            return BadRequest("Password is required.");

        User? user = await _context.Users
            .Include(currentUser => currentUser.Role)
            .FirstOrDefaultAsync(currentUser => currentUser.Email == email, cancellationToken);

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

        string token = _jwtService.GenerateAccessToken(user.Id, user.Role.Name);

        return Ok(new AccessTokenResponse
        {
            Token = token
        });
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

    private static string GenerateEmailConfirmationCode() => RandomNumberGenerator.GetInt32(100000, 1000000).ToString();

    private static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();
}