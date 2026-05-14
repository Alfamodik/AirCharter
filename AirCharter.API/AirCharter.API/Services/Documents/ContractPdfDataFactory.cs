using System.Globalization;
using AirCharter.API.Model;

namespace AirCharter.API.Services.Documents;

public sealed class ContractPdfDataFactory
{
    public ContractPdfDataResult Create(Departure departure, User signingUser)
    {
        List<string> missingFields = new List<string>();

        Person? customer = departure.CharterRequester.Person;
        Person? signerPerson = signingUser.Person;
        Airline? airline = departure.Plane.Airline;

        Require(customer, "профиль заказчика", missingFields);
        Require(signerPerson, "профиль подписанта авиакомпании", missingFields);
        Require(airline, "авиакомпания самолёта", missingFields);

        if (customer is null || signerPerson is null || airline is null)
            return Missing(missingFields);

        string customerFullName = RequireValue(BuildPersonFullName(customer), "ФИО заказчика", missingFields);
        string signerFullName = RequireValue(BuildPersonFullName(signerPerson), "ФИО подписанта авиакомпании", missingFields);
        string contractCity = RequireValue(airline.ContractCity, "город договора в профиле авиакомпании", missingFields);
        int? contractValidityDays = RequirePositiveValue(airline.ContractValidityDays, "срок действия договора в днях в профиле авиакомпании", missingFields);
        int? paymentDeadlineDays = RequirePositiveValue(airline.PaymentDeadlineDays, "срок оплаты в днях в профиле авиакомпании", missingFields);
        int? passengerArrivalMinutes = RequirePositiveValue(
            airline.PassengerArrivalMinutesBeforeFlight,
            "за сколько минут пассажиры должны прибыть в аэропорт в профиле авиакомпании",
            missingFields);
        string cateringClass = RequireValue(airline.CateringClass, "класс бортпитания в профиле авиакомпании", missingFields);

        string executorFullName = RequireValue(AirlineOrganizationTypes.BuildFullOrganizationName(airline), "полное наименование авиакомпании", missingFields);
        string executorShortName = RequireValue(AirlineOrganizationTypes.BuildShortOrganizationName(airline), "краткое наименование авиакомпании", missingFields);
        string executorLegalAddress = RequireValue(airline.LegalAddress, "юридический адрес авиакомпании", missingFields);
        string executorPostalAddress = RequireValue(airline.PostalAddress, "почтовый адрес авиакомпании", missingFields);
        string executorTaxpayerId = RequireValue(airline.TaxpayerId, "ИНН авиакомпании", missingFields);
        string executorTaxRegistrationReasonCode = RequireValue(airline.TaxRegistrationReasonCode, "КПП авиакомпании", missingFields);
        string executorPrimaryStateRegistrationNumber = RequireValue(airline.PrimaryStateRegistrationNumber, "ОГРН авиакомпании", missingFields);
        string executorCurrentAccountNumber = RequireValue(airline.CurrentAccountNumber, "расчётный счёт авиакомпании", missingFields);
        string executorBankName = RequireValue(airline.BankName, "банк авиакомпании", missingFields);
        string executorCorrespondentAccountNumber = RequireValue(airline.CorrespondentAccountNumber, "корреспондентский счёт авиакомпании", missingFields);
        string executorBankIdentifierCode = RequireValue(airline.BankIdentifierCode, "БИК авиакомпании", missingFields);
        string executorEmail = RequireValue(airline.Email, "email авиакомпании", missingFields);
        string executorPhoneNumber = RequireValue(airline.PhoneNumber, "телефон авиакомпании", missingFields);

        string customerRegistrationAddress = RequireValue(customer.RegistrationAddress, "адрес регистрации", missingFields);
        string customerActualAddress = RequireValue(customer.ActualAddress, "фактический адрес", missingFields);
        string customerPassportSeries = RequireValue(customer.PassportSeries, "серия паспорта заказчика", missingFields);
        string customerPassportNumber = RequireValue(customer.PassportNumber, "номер паспорта заказчика", missingFields);
        string customerTaxpayerId = RequireValue(customer.TaxpayerId, "ИНН", missingFields);
        string customerBankName = RequireValue(customer.BankName, "банк", missingFields);
        string customerCurrentAccountNumber = RequireValue(customer.CurrentAccountNumber, "счёт", missingFields);
        string customerBankIdentifierCode = RequireValue(customer.BankIdentifierCode, "БИК банка", missingFields);
        string customerEmail = RequireValue(GetCustomerEmail(departure.CharterRequester, customer), "email заказчика", missingFields);
        string customerPhoneNumber = RequireValue(customer.PhoneNumber, "телефон", missingFields);

        DateTime contractDate = GetSubmittedAt(departure) ?? GetCreatedAt(departure) ?? DateTime.UtcNow;

        if (departure.People.Count == 0)
            missingFields.Add("список пассажиров");

        if (departure.DepartureRouteLegs.Count == 0)
            missingFields.Add("зафиксированный маршрут");

        if (missingFields.Count > 0)
            return Missing(missingFields);

        DateTime landingDateTime = departure.RequestedTakeOffDateTime.Add(departure.FlightTime);
        DateOnly contractEndDate = DateOnly.FromDateTime(contractDate.Date.AddDays(contractValidityDays!.Value));
        DateOnly paymentDeadlineDate = DateOnly.FromDateTime(contractDate.Date.AddDays(paymentDeadlineDays!.Value));

        ContractPdfData data = new ContractPdfData
        {
            ContractNumber = departure.Id.ToString(CultureInfo.InvariantCulture),
            OrderNumber = departure.Id.ToString(CultureInfo.InvariantCulture),
            ContractCity = contractCity,
            ContractDate = contractDate,
            ContractEndDate = contractEndDate,
            PaymentDeadlineDate = paymentDeadlineDate,
            ExecutorFullName = executorFullName,
            ExecutorShortName = executorShortName,
            ExecutorLegalAddress = executorLegalAddress,
            ExecutorPostalAddress = executorPostalAddress,
            ExecutorTaxpayerId = executorTaxpayerId,
            ExecutorTaxRegistrationReasonCode = executorTaxRegistrationReasonCode,
            ExecutorPrimaryStateRegistrationNumber = executorPrimaryStateRegistrationNumber,
            ExecutorCurrentAccountNumber = executorCurrentAccountNumber,
            ExecutorBankName = executorBankName,
            ExecutorCorrespondentAccountNumber = executorCorrespondentAccountNumber,
            ExecutorBankIdentifierCode = executorBankIdentifierCode,
            ExecutorEmail = executorEmail,
            ExecutorPhoneNumber = executorPhoneNumber,
            ExecutorDirectorFullName = signerFullName,
            ExecutorDirectorInitials = BuildInitials(signerPerson),
            ExecutorDirectorPosition = GetSignerPosition(signingUser),
            CustomerFullName = customerFullName,
            CustomerInitials = BuildInitials(customer),
            CustomerRegistrationAddress = customerRegistrationAddress,
            CustomerActualAddress = customerActualAddress,
            CustomerPassportSeries = customerPassportSeries,
            CustomerPassportNumber = customerPassportNumber,
            CustomerTaxpayerId = customerTaxpayerId,
            CustomerBankName = customerBankName,
            CustomerCurrentAccountNumber = customerCurrentAccountNumber,
            CustomerBankIdentifierCode = customerBankIdentifierCode,
            CustomerEmail = customerEmail,
            CustomerPhoneNumber = customerPhoneNumber,
            PlaneModelName = departure.Plane.ModelName,
            RouteText = BuildRouteText(departure),
            TakeOffAirport = BuildAirportLabel(departure.TakeOffAirport),
            LandingAirport = BuildAirportLabel(departure.LandingAirport),
            TakeOffDateTime = departure.RequestedTakeOffDateTime,
            LandingDateTime = landingDateTime,
            FlightTime = departure.FlightTime,
            PassengerCount = departure.People.Count,
            PassengerArrivalMinutesBeforeFlight = passengerArrivalMinutes!.Value,
            PassengerArrivalText = FormatMinutes(passengerArrivalMinutes.Value),
            CateringClass = cateringClass,
            FlightPrice = departure.Price,
            FlightPriceText = $"{NumberToRussianWords((long)Math.Round(departure.Price, 0, MidpointRounding.AwayFromZero))} рублей"
        };

        return new ContractPdfDataResult { Data = data };
    }

    private static ContractPdfDataResult Missing(IReadOnlyCollection<string> missingFields)
    {
        return new ContractPdfDataResult
        {
            MissingFields = missingFields
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(field => field)
                .ToArray()
        };
    }

    private static void Require(object? value, string fieldName, List<string> missingFields)
    {
        if (value is null)
            missingFields.Add(fieldName);
    }

    private static string RequireValue(string? value, string fieldName, List<string> missingFields)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            missingFields.Add(fieldName);
            return string.Empty;
        }

        return value.Trim();
    }

    private static int? RequirePositiveValue(int? value, string fieldName, List<string> missingFields)
    {
        if (value is null or <= 0)
            missingFields.Add(fieldName);

        return value;
    }

    private static DateTime? GetSubmittedAt(Departure departure)
    {
        return departure.DepartureStatuses
            .Where(departureStatus => departureStatus.StatusId == 2)
            .OrderBy(departureStatus => departureStatus.StatusSettingDateTime)
            .Select(departureStatus => (DateTime?)departureStatus.StatusSettingDateTime)
            .FirstOrDefault();
    }

    private static DateTime? GetCreatedAt(Departure departure)
    {
        return departure.DepartureStatuses
            .Where(departureStatus => departureStatus.StatusId == 1)
            .OrderBy(departureStatus => departureStatus.StatusSettingDateTime)
            .Select(departureStatus => (DateTime?)departureStatus.StatusSettingDateTime)
            .FirstOrDefault();
    }

    private static string BuildRouteText(Departure departure)
    {
        List<string> airports = departure.DepartureRouteLegs
            .OrderBy(leg => leg.SequenceNumber)
            .Select(leg => BuildAirportLabel(leg.FromAirport))
            .ToList();

        airports.Add(BuildAirportLabel(departure.LandingAirport));

        return string.Join(" → ", airports);
    }

    private static string BuildAirportLabel(Airport airport)
    {
        string? code = airport.Iata ?? airport.Icao;
        string name = airport.City ?? airport.Name;

        return string.IsNullOrWhiteSpace(code)
            ? name
            : $"{name} ({code})";
    }

    private static string BuildPersonFullName(Person person)
    {
        return string.Join(
            " ",
            new[] { person.LastName, person.FirstName, person.Patronymic }
                .Where(part => !string.IsNullOrWhiteSpace(part)));
    }

    private static string BuildInitials(Person person)
    {
        string firstInitial = string.IsNullOrWhiteSpace(person.FirstName) ? "" : $"{person.FirstName[0]}.";
        string patronymicInitial = string.IsNullOrWhiteSpace(person.Patronymic) ? "" : $"{person.Patronymic[0]}.";

        return $"{person.LastName} {firstInitial}{patronymicInitial}".Trim();
    }

    private static string GetSignerPosition(User user)
    {
        return user.Role.Name == "Owner" ? "Владелец" : "Генеральный директор";
    }

    private static string? GetCustomerEmail(User user, Person person)
    {
        return string.IsNullOrWhiteSpace(person.Email) ? user.Email : person.Email;
    }

    private static string FormatMinutes(int minutes)
    {
        int hours = minutes / 60;
        int remainderMinutes = minutes % 60;

        if (hours <= 0)
            return $"{minutes} мин";

        if (remainderMinutes == 0)
            return $"{hours} ч";

        return $"{hours} ч {remainderMinutes} мин";
    }

    private static string NumberToRussianWords(long value)
    {
        if (value == 0)
            return "ноль";

        string[] units = { "", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять" };
        string[] unitsFemale = { "", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять" };
        string[] teens = { "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать" };
        string[] tens = { "", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто" };
        string[] hundreds = { "", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот" };

        List<string> parts = new List<string>();
        AddGroup(parts, value / 1_000_000, "миллион", "миллиона", "миллионов", units, teens, tens, hundreds);
        AddGroup(parts, value / 1_000 % 1000, "тысяча", "тысячи", "тысяч", unitsFemale, teens, tens, hundreds);
        AddGroup(parts, value % 1000, "", "", "", units, teens, tens, hundreds);

        return string.Join(" ", parts.Where(part => !string.IsNullOrWhiteSpace(part)));
    }

    private static void AddGroup(
        List<string> parts,
        long groupValue,
        string one,
        string two,
        string many,
        IReadOnlyList<string> units,
        IReadOnlyList<string> teens,
        IReadOnlyList<string> tens,
        IReadOnlyList<string> hundreds)
    {
        if (groupValue == 0)
            return;

        parts.Add(hundreds[(int)(groupValue / 100)]);

        long lastTwo = groupValue % 100;

        if (lastTwo is >= 10 and <= 19)
        {
            parts.Add(teens[(int)(lastTwo - 10)]);
        }
        else
        {
            parts.Add(tens[(int)(lastTwo / 10)]);
            parts.Add(units[(int)(lastTwo % 10)]);
        }

        if (!string.IsNullOrWhiteSpace(one))
            parts.Add(ChoosePlural(groupValue, one, two, many));
    }

    private static string ChoosePlural(long value, string one, string two, string many)
    {
        long lastTwo = value % 100;

        if (lastTwo is >= 11 and <= 14)
            return many;

        return (value % 10) switch
        {
            1 => one,
            >= 2 and <= 4 => two,
            _ => many
        };
    }
}
