export interface UserPersonResponse {
    id: number;
    firstName: string;
    lastName: string;
    patronymic?: string | null;
    passportSeries: string;
    passportNumber: string;
    birthDate?: string | null;
    email?: string | null;
    registrationAddress?: string | null;
    actualAddress?: string | null;
    phoneNumber?: string | null;
    taxpayerId?: string | null;
    bankName?: string | null;
    currentAccountNumber?: string | null;
    correspondentAccountNumber?: string | null;
    bankIdentifierCode?: string | null;
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
