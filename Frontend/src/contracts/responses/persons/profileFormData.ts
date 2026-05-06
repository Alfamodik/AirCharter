export interface ProfileFormData {
    firstName: string;
    lastName: string;
    patronymic: string | null;
    passportSeries: string;
    passportNumber: string;
    email: string | null;
    birthDate: string | null;
    registrationAddress: string | null;
    actualAddress: string | null;
    phoneNumber: string | null;
    taxpayerId: string | null;
    bankName: string | null;
    currentAccountNumber: string | null;
    correspondentAccountNumber: string | null;
    bankIdentifierCode: string | null;
}
