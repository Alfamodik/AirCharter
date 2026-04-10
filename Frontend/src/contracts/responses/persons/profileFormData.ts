export interface ProfileFormData {
    firstName: string;
    lastName: string;
    patronymic: string | null;
    passportSeries: string;
    passportNumber: string;
    email: string | null;
    birthDate: string | null;
}