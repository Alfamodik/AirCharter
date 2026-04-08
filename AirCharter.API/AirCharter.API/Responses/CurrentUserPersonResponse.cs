namespace AirCharter.API.Responses
{
    public sealed class CurrentUserPersonResponse
    {
        public int Id { get; set; }

        public string FirstName { get; set; } = null!;

        public string LastName { get; set; } = null!;

        public string? Patronymic { get; set; }

        public string PassportSeries { get; set; } = null!;

        public string PassportNumber { get; set; } = null!;

        public DateOnly? BirthDate { get; set; }

        public string? Email { get; set; }
    }
}
