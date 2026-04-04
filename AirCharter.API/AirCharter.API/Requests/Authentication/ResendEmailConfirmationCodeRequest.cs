namespace AirCharter.API.Requests.Authentication
{
    public sealed class ResendEmailConfirmationCodeRequest
    {
        public string Email { get; set; } = string.Empty;
    }
}
