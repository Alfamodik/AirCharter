namespace AirCharter.API.Requests
{
    public sealed class ResendEmailConfirmationCodeRequest
    {
        public string Email { get; set; } = string.Empty;
    }
}
