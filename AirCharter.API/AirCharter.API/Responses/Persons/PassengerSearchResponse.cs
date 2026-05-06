namespace AirCharter.API.Responses.Persons
{
    public sealed class PassengerSearchResponse
    {
        public int Id { get; set; }

        public string FullName { get; set; } = string.Empty;

        public string? Email { get; set; }
    }

    public sealed class PersonEditResponse
    {
        public int Id { get; set; }

        public string FirstName { get; set; } = string.Empty;

        public string LastName { get; set; } = string.Empty;

        public string? Patronymic { get; set; }

        public string PassportSeries { get; set; } = string.Empty;

        public string PassportNumber { get; set; } = string.Empty;

        public string? Email { get; set; }

        public DateOnly? BirthDate { get; set; }

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
