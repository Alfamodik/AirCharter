import { sendRequest } from "./sendRequest";

export interface AirlineContractSettingsResponse {
    id: number;
    airlineName: string;
    organizationType: string;
    legalAddress: string;
    postalAddress: string;
    phoneNumber: string;
    email: string;
    serviceBaseCost: number;
    transferBaseCost: number;
    bankName: string;
    taxpayerId: string;
    taxRegistrationReasonCode: string;
    primaryStateRegistrationNumber: string;
    currentAccountNumber: string;
    correspondentAccountNumber: string;
    bankIdentifierCode: string;
    contractCity?: string | null;
    contractValidityDays?: number | null;
    paymentDeadlineDays?: number | null;
    cateringClass?: string | null;
    passengerArrivalMinutesBeforeFlight?: number | null;
    isCatalogVisible: boolean;
    hasDepartures: boolean;
    imageBase64?: string | null;
}

export interface UpdateAirlineContractSettingsRequest {
    airlineName: string;
    organizationType: string;
    legalAddress: string;
    postalAddress: string;
    phoneNumber: string;
    email: string;
    serviceBaseCost: number | null;
    transferBaseCost: number | null;
    bankName: string;
    taxpayerId: string;
    taxRegistrationReasonCode: string;
    primaryStateRegistrationNumber: string;
    currentAccountNumber: string;
    correspondentAccountNumber: string;
    bankIdentifierCode: string;
    contractCity: string | null;
    contractValidityDays: number | null;
    paymentDeadlineDays: number | null;
    cateringClass: string | null;
    passengerArrivalMinutesBeforeFlight: number | null;
}

export interface AirlineEmployeeResponse {
    id: number;
    email: string;
    roleName: string;
    fullName?: string | null;
    isEmailConfirmed: boolean;
    isActive: boolean;
}

export interface CreateAirlineEmployeeRequest {
    email: string;
    roleName: string;
}

export interface UpdateAirlineEmployeeRoleRequest {
    roleName: string;
}

export interface CreateAirlineEmployeeResponse {
    employee?: AirlineEmployeeResponse | null;
    notificationCreated: boolean;
    message: string;
}

export interface AirlineNotificationResponse {
    id: number;
    title: string;
    message: string;
    createdAtUtc: string;
    readAtUtc?: string | null;
}

export interface AccessTokenResponse {
    token: string;
}

export type RegisterAirlineRequest = UpdateAirlineContractSettingsRequest;

export async function registerAirline(data: RegisterAirlineRequest): Promise<AccessTokenResponse> {
    return await sendRequest<AccessTokenResponse>(
        "/airlines/register",
        "POST",
        data
    );
}

export async function getMyAirlineEmployees(
    availableForDepartureId?: number,
    includeInactiveOrSignal: boolean | AbortSignal = false,
    signal?: AbortSignal
): Promise<AirlineEmployeeResponse[]> {
    const includeInactive = typeof includeInactiveOrSignal === "boolean"
        ? includeInactiveOrSignal
        : false;
    const requestSignal = typeof includeInactiveOrSignal === "boolean"
        ? signal
        : includeInactiveOrSignal;
    const searchParameters = new URLSearchParams();

    if (availableForDepartureId !== undefined) {
        searchParameters.set("availableForDepartureId", availableForDepartureId.toString());
    }

    if (includeInactive) {
        searchParameters.set("includeInactive", "true");
    }

    const query = searchParameters.toString() === ""
        ? ""
        : `?${searchParameters.toString()}`;

    return await sendRequest<AirlineEmployeeResponse[]>(
        `/airlines/my/employees${query}`,
        "GET",
        undefined,
        requestSignal
    );
}

export async function getMyAirlineContractSettings(): Promise<AirlineContractSettingsResponse> {
    return await sendRequest<AirlineContractSettingsResponse>(
        "/airlines/my/contract-settings",
        "GET"
    );
}

export async function updateMyAirlineContractSettings(
    data: UpdateAirlineContractSettingsRequest
): Promise<AirlineContractSettingsResponse> {
    return await sendRequest<AirlineContractSettingsResponse>(
        "/airlines/my/contract-settings",
        "PUT",
        data
    );
}

export async function updateMyAirlineImage(imageBase64: string | null): Promise<void> {
    await sendRequest<void>(
        "/airlines/my/image",
        "PUT",
        { imageBase64 }
    );
}

export async function createMyAirlineEmployee(
    data: CreateAirlineEmployeeRequest
): Promise<CreateAirlineEmployeeResponse> {
    return await sendRequest<CreateAirlineEmployeeResponse>(
        "/airlines/my/employees",
        "POST",
        data
    );
}

export async function updateMyAirlineEmployeeRole(
    employeeId: number,
    data: UpdateAirlineEmployeeRoleRequest
): Promise<AirlineEmployeeResponse> {
    return await sendRequest<AirlineEmployeeResponse>(
        `/airlines/my/employees/${employeeId}/role`,
        "PUT",
        data
    );
}

export async function dismissMyAirlineEmployee(employeeId: number): Promise<void> {
    await sendRequest<void>(`/airlines/my/employees/${employeeId}`, "DELETE");
}

export async function resignFromMyAirline(): Promise<void> {
    await sendRequest<void>("/airlines/my/employment", "DELETE");
}

export async function getMyAirlineNotifications(signal?: AbortSignal): Promise<AirlineNotificationResponse[]> {
    return await sendRequest<AirlineNotificationResponse[]>(
        "/airlines/my/notifications",
        "GET",
        undefined,
        signal
    );
}

export async function deleteMyAirline(): Promise<void> {
    await sendRequest<void>("/airlines/my", "DELETE");
}

export async function updateMyAirlineCatalogVisibility(
    isCatalogVisible: boolean
): Promise<AirlineContractSettingsResponse> {
    return await sendRequest<AirlineContractSettingsResponse>(
        "/airlines/my/catalog-visibility",
        "PUT",
        { isCatalogVisible }
    );
}
