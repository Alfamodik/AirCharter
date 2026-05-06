import { sendRequest } from "./sendRequest";

export interface AirlineContractSettingsResponse {
    id: number;
    airlineName: string;
    organizationFullName: string;
    organizationShortName: string;
    legalAddress: string;
    postalAddress: string;
    phoneNumber: string;
    email: string;
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
    organizationFullName: string;
    organizationShortName: string;
    legalAddress: string;
    postalAddress: string;
    phoneNumber: string;
    email: string;
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
