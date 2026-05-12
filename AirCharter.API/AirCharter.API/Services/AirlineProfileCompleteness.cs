using AirCharter.API.Model;
using System.Linq.Expressions;

namespace AirCharter.API.Services;

public static class AirlineProfileCompleteness
{
    public static Expression<Func<Plane, bool>> PlaneHasCatalogVisibleAirline => plane =>
        plane.Airline.AirlineName != null && plane.Airline.AirlineName != "" &&
        plane.Airline.OrganizationFullName != null && plane.Airline.OrganizationFullName != "" &&
        plane.Airline.OrganizationShortName != null && plane.Airline.OrganizationShortName != "" &&
        plane.Airline.LegalAddress != null && plane.Airline.LegalAddress != "" &&
        plane.Airline.PostalAddress != null && plane.Airline.PostalAddress != "" &&
        plane.Airline.PhoneNumber != null && plane.Airline.PhoneNumber != "" &&
        plane.Airline.Email != null && plane.Airline.Email != "" &&
        plane.Airline.ServiceBaseCost > 0 &&
        plane.Airline.TransferBaseCost > 0 &&
        plane.Airline.BankName != null && plane.Airline.BankName != "" &&
        plane.Airline.TaxpayerId != null && plane.Airline.TaxpayerId != "" &&
        plane.Airline.TaxRegistrationReasonCode != null && plane.Airline.TaxRegistrationReasonCode != "" &&
        plane.Airline.PrimaryStateRegistrationNumber != null && plane.Airline.PrimaryStateRegistrationNumber != "" &&
        plane.Airline.CurrentAccountNumber != null && plane.Airline.CurrentAccountNumber != "" &&
        plane.Airline.CorrespondentAccountNumber != null && plane.Airline.CorrespondentAccountNumber != "" &&
        plane.Airline.BankIdentifierCode != null && plane.Airline.BankIdentifierCode != "" &&
        plane.Airline.ContractCity != null && plane.Airline.ContractCity != "" &&
        plane.Airline.ContractValidityDays != null && plane.Airline.ContractValidityDays > 0 &&
        plane.Airline.PaymentDeadlineDays != null && plane.Airline.PaymentDeadlineDays > 0 &&
        plane.Airline.CateringClass != null && plane.Airline.CateringClass != "" &&
        plane.Airline.PassengerArrivalMinutesBeforeFlight != null &&
        plane.Airline.PassengerArrivalMinutesBeforeFlight > 0;

    public static string? Validate(Airline airline)
    {
        if (IsBlank(airline.AirlineName))
            return "Укажите название авиакомпании.";

        if (IsBlank(airline.OrganizationFullName))
            return "Укажите полное наименование организации.";

        if (IsBlank(airline.OrganizationShortName))
            return "Укажите краткое наименование организации.";

        if (IsBlank(airline.LegalAddress))
            return "Укажите юридический адрес.";

        if (IsBlank(airline.PostalAddress))
            return "Укажите почтовый адрес.";

        if (IsBlank(airline.PhoneNumber))
            return "Укажите телефон.";

        if (IsBlank(airline.Email))
            return "Укажите email.";

        if (airline.ServiceBaseCost <= 0)
            return "Базовая стоимость обслуживания должна быть больше 0.";

        if (airline.TransferBaseCost <= 0)
            return "Базовая стоимость пересадки должна быть больше 0.";

        if (IsBlank(airline.BankName))
            return "Укажите банк.";

        if (IsBlank(airline.TaxpayerId))
            return "Укажите ИНН.";

        if (IsBlank(airline.TaxRegistrationReasonCode))
            return "Укажите КПП.";

        if (IsBlank(airline.PrimaryStateRegistrationNumber))
            return "Укажите ОГРН.";

        if (IsBlank(airline.CurrentAccountNumber))
            return "Укажите расчетный счет.";

        if (IsBlank(airline.CorrespondentAccountNumber))
            return "Укажите корреспондентский счет.";

        if (IsBlank(airline.BankIdentifierCode))
            return "Укажите БИК.";

        if (IsBlank(airline.ContractCity))
            return "Укажите город договора.";

        if (airline.ContractValidityDays is null or <= 0)
            return "Срок действия договора должен быть больше 0.";

        if (airline.PaymentDeadlineDays is null or <= 0)
            return "Срок оплаты должен быть больше 0.";

        if (IsBlank(airline.CateringClass))
            return "Укажите класс бортпитания.";

        if (airline.PassengerArrivalMinutesBeforeFlight is null or <= 0)
            return "Время прибытия пассажиров должно быть больше 0.";

        return null;
    }

    private static bool IsBlank(string? value)
    {
        return string.IsNullOrWhiteSpace(value);
    }
}
