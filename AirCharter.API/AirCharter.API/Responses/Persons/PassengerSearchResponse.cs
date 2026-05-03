namespace AirCharter.API.Responses.Persons
{
    public sealed class PassengerSearchResponse
    {
        public int Id { get; set; }

        public string FullName { get; set; } = string.Empty;

        public string? Email { get; set; }
    }
}
