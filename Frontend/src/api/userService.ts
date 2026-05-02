import { sendRequest } from "./sendRequest";
import type { MyDepartureResponse } from "../contracts/responses/users/myDepartureResponse";
import type { UserProfileResponse } from "../contracts/responses/users/userPersonResponse";
import type { ManagementDepartureResponse } from "../contracts/responses/departures/managementDepartureResponse";
import type {
    ManagementRoutePreviewResponse,
    UpdateDepartureRouteRequest
} from "./managementService";

export async function getCurrentUser(signal?: AbortSignal): Promise<UserProfileResponse> {
    return await sendRequest<UserProfileResponse>("/users/me", "GET", undefined, signal);
}

export async function getUserDepartures(signal?: AbortSignal): Promise<MyDepartureResponse[]> {
    return await sendRequest<MyDepartureResponse[]>("/users/me/departures", "GET", undefined, signal);
}

export async function getUserDeparture(
    departureId: number,
    signal?: AbortSignal
): Promise<ManagementDepartureResponse> {
    return await sendRequest<ManagementDepartureResponse>(
        `/departures/my/${departureId}`,
        "GET",
        undefined,
        signal
    );
}

export async function previewUserDepartureRoute(
    departureId: number,
    request: UpdateDepartureRouteRequest,
    signal?: AbortSignal
): Promise<ManagementRoutePreviewResponse> {
    return await sendRequest<ManagementRoutePreviewResponse>(
        `/departures/my/${departureId}/route-preview`,
        "POST",
        request,
        signal
    );
}

export async function saveUserDepartureRoute(
    departureId: number,
    request: UpdateDepartureRouteRequest
): Promise<void> {
    await sendRequest<void>(
        `/departures/my/${departureId}/route`,
        "POST",
        request
    );
}
