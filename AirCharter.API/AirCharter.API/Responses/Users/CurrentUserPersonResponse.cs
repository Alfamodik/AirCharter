namespace AirCharter.API.Responses.Users
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

        public string? RegistrationAddress { get; set; }

        public string? ActualAddress { get; set; }

        public string? PhoneNumber { get; set; }

        public string? TaxpayerId { get; set; }

        public string? BankName { get; set; }

        public string? CurrentAccountNumber { get; set; }

        public string? CorrespondentAccountNumber { get; set; }

        public string? BankIdentifierCode { get; set; }
    }
}
