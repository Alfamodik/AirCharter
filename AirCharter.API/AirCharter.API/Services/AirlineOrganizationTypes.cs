using AirCharter.API.Model;

namespace AirCharter.API.Services;

public enum AirlineOrganizationType
{
    Ooo,
    Pao,
    Ao,
    Zao,
    Oao,
    Ip
}

public sealed record AirlineOrganizationTypeInfo(
    AirlineOrganizationType Type,
    string Code,
    string FullName);

public static class AirlineOrganizationTypes
{
    public static readonly AirlineOrganizationTypeInfo[] All =
    [
        new(AirlineOrganizationType.Ooo, "ООО", "Общество с ограниченной ответственностью"),
        new(AirlineOrganizationType.Pao, "ПАО", "Публичное акционерное общество"),
        new(AirlineOrganizationType.Ao, "АО", "Акционерное общество"),
        new(AirlineOrganizationType.Zao, "ЗАО", "Закрытое акционерное общество"),
        new(AirlineOrganizationType.Oao, "ОАО", "Открытое акционерное общество"),
        new(AirlineOrganizationType.Ip, "ИП", "Индивидуальный предприниматель")
    ];

    public static bool TryGet(string? value, out AirlineOrganizationTypeInfo info)
    {
        string normalizedValue = Normalize(value);

        foreach (AirlineOrganizationTypeInfo candidate in All)
        {
            if (Normalize(candidate.Code) == normalizedValue ||
                Normalize(candidate.FullName) == normalizedValue ||
                Normalize(candidate.Type.ToString()) == normalizedValue)
            {
                info = candidate;
                return true;
            }
        }

        info = default!;
        return false;
    }

    public static AirlineOrganizationTypeInfo? Resolve(Airline airline)
    {
        if (TryGet(airline.OrganizationShortName, out AirlineOrganizationTypeInfo byShortName))
            return byShortName;

        if (TryGet(airline.OrganizationFullName, out AirlineOrganizationTypeInfo byFullName))
            return byFullName;

        string normalizedShortName = Normalize(airline.OrganizationShortName);
        string normalizedFullName = Normalize(airline.OrganizationFullName);

        return All.FirstOrDefault(type =>
            normalizedShortName.StartsWith(Normalize(type.Code), StringComparison.Ordinal) ||
            normalizedFullName.StartsWith(Normalize(type.FullName), StringComparison.Ordinal));
    }

    public static string BuildFullOrganizationName(Airline airline)
    {
        AirlineOrganizationTypeInfo? type = Resolve(airline);

        return type is null
            ? airline.OrganizationFullName
            : $"{type.FullName} {Quote(airline.AirlineName)}";
    }

    public static string BuildShortOrganizationName(Airline airline)
    {
        AirlineOrganizationTypeInfo? type = Resolve(airline);

        return type is null
            ? airline.OrganizationShortName
            : $"{type.Code} {Quote(airline.AirlineName)}";
    }

    private static string Quote(string value)
    {
        string trimmedValue = value.Trim().Trim('«', '»', '"');

        return $"«{trimmedValue}»";
    }

    private static string Normalize(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? string.Empty
            : value.Trim().Replace(".", string.Empty).ToUpperInvariant();
    }
}
