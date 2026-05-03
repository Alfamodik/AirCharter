namespace AirCharter.API.Requests.Persons
{
    public sealed class UpdatePersonRequest
    {
        public string FirstName { get; set; } = null!;
        public string LastName { get; set; } = null!;
        public string? Patronymic { get; set; }
        public string PassportSeries { get; set; } = null!;
        public string PassportNumber { get; set; } = null!;
        public string? Email { get; set; }
        public DateOnly? BirthDate { get; set; }
    }

    public sealed class CreatePersonRequest
    {
        public string FirstName { get; set; } = null!;
        public string LastName { get; set; } = null!;
        public string? Patronymic { get; set; }
        public string PassportSeries { get; set; } = null!;
        public string PassportNumber { get; set; } = null!;
        public string? Email { get; set; }
        public DateOnly? BirthDate { get; set; }
    }
}
