using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace AirCharter.API.Services
{
    public sealed class JwtService(IConfiguration configuration)
    {
        private readonly IConfiguration configuration = configuration;

        public string GenerateAccessToken(int userId, string roleName)
        {
            string secretKey = configuration["Jwt:SecretKey"]
                ?? throw new InvalidOperationException("Jwt:SecretKey is not configured.");

            string issuer = configuration["Jwt:Issuer"]
                ?? throw new InvalidOperationException("Jwt:Issuer is not configured.");

            string audience = configuration["Jwt:Audience"]
                ?? throw new InvalidOperationException("Jwt:Audience is not configured.");

            string accessTokenLifetimeMinutesValue = configuration["Jwt:AccessTokenLifetimeMinutes"]
                ?? throw new InvalidOperationException("Jwt:AccessTokenLifetimeMinutes is not configured.");

            bool isLifetimeParsed = int.TryParse(accessTokenLifetimeMinutesValue, out int accessTokenLifetimeMinutes);

            if (!isLifetimeParsed || accessTokenLifetimeMinutes <= 0)
                throw new InvalidOperationException("Jwt:AccessTokenLifetimeMinutes must be a positive integer.");

            SymmetricSecurityKey signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
            SigningCredentials signingCredentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

            List<Claim> claims =
            [
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Role, roleName)
            ];

            DateTime expiresAtUtc = DateTime.UtcNow.AddMinutes(accessTokenLifetimeMinutes);

            JwtSecurityToken jwtSecurityToken = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                expires: expiresAtUtc,
                signingCredentials: signingCredentials);

            JwtSecurityTokenHandler jwtSecurityTokenHandler = new JwtSecurityTokenHandler();

            return jwtSecurityTokenHandler.WriteToken(jwtSecurityToken);
        }
    }
}
