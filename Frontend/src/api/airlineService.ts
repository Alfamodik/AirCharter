import { sendRequest } from "./sendRequest";

export interface AirlineContractSettingsResponse {
    id: number;
    airlineName: string;
    organizationType: string;
    organizationFullName: string;
    organizationShortName: string;
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
    signal?: AbortSignal
): Promise<AirlineEmployeeResponse[]> {
    const query = availableForDepartureId === undefined
        ? ""
        : `?availableForDepartureId=${availableForDepartureId}`;

    return await sendRequest<AirlineEmployeeResponse[]>(
        `/airlines/my/employees${query}`,
        "GET",
        undefined,
        signal
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
