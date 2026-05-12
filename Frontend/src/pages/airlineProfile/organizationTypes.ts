export const organizationTypeOptions = [
    {
        value: "ООО",
        label: "ООО - Общество с ограниченной ответственностью"
    },
    {
        value: "ПАО",
        label: "ПАО - Публичное акционерное общество"
    },
    {
        value: "АО",
        label: "АО - Акционерное общество"
    },
    {
        value: "ЗАО",
        label: "ЗАО - Закрытое акционерное общество"
    },
    {
        value: "ОАО",
        label: "ОАО - Открытое акционерное общество"
    },
    {
        value: "ИП",
        label: "ИП - Индивидуальный предприниматель"
    }
];

export function inferOrganizationType(shortName?: string | null, fullName?: string | null): string {
    const normalizedShortName = shortName?.trim().toUpperCase() ?? "";
    const normalizedFullName = fullName?.trim().toUpperCase() ?? "";

    return organizationTypeOptions.find((option) =>
        normalizedShortName.startsWith(option.value) ||
        normalizedFullName.startsWith(option.label.split(" - ")[1].toUpperCase())
    )?.value ?? "";
}
