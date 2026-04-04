namespace AirCharter.API.Requests.Authentication
{
    public sealed class ConfirmEmailRequest
    {
        public string Email { get; set; } = string.Empty;

        public string Code { get; set; } = string.Empty;
    }
}
