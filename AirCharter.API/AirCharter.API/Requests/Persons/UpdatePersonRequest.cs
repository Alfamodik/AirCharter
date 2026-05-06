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
        public string? RegistrationAddress { get; set; }
        public string? ActualAddress { get; set; }
        public string? PhoneNumber { get; set; }
        public string? TaxpayerId { get; set; }
        public string? BankName { get; set; }
        public string? CurrentAccountNumber { get; set; }
        public string? CorrespondentAccountNumber { get; set; }
        public string? BankIdentifierCode { get; set; }
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
        public string? RegistrationAddress { get; set; }
        public string? ActualAddress { get; set; }
        public string? PhoneNumber { get; set; }
        public string? TaxpayerId { get; set; }
        public string? BankName { get; set; }
        public string? CurrentAccountNumber { get; set; }
        public string? CorrespondentAccountNumber { get; set; }
        public string? BankIdentifierCode { get; set; }
    }

    public sealed class PersonPassportRequest
    {
        public string PassportSeries { get; set; } = null!;
        public string PassportNumber { get; set; } = null!;
    }

    public sealed class UpdatePassengerByPassportRequest
    {
        public string CurrentPassportSeries { get; set; } = null!;
        public string CurrentPassportNumber { get; set; } = null!;
        public string FirstName { get; set; } = null!;
        public string LastName { get; set; } = null!;
        public string? Patronymic { get; set; }
        public string PassportSeries { get; set; } = null!;
        public string PassportNumber { get; set; } = null!;
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
