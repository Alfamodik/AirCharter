export interface UserPersonResponse {
    id: number;
    firstName: string;
    lastName: string;
    patronymic?: string | null;
    passportSeries: string;
    passportNumber: string;
    birthDate?: string | null;
    email?: string | null;
}

export interface UserRoleResponse {
    id: number;
    name: string;
}

export interface UserProfileResponse {
    id: number;
    email: string;
    isEmailConfirmed: boolean;
    isActive: boolean;
    airlineId?: number | null;
    person?: UserPersonResponse | null;
    role: UserRoleResponse;
}