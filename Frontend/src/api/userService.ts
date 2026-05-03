import { sendRequest } from "./sendRequest";
import type { MyDepartureResponse } from "../contracts/responses/users/myDepartureResponse";
import type { UserProfileResponse } from "../contracts/responses/users/userPersonResponse";
import type { ManagementDepartureResponse } from "../contracts/responses/departures/managementDepartureResponse";
import type {
    ManagementRouteCandidateResponse,
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

export async function getUserRouteCandidates(
    departureId: number,
    fromAirportId: number,
    toAirportId: number | null,
    signal?: AbortSignal
): Promise<ManagementRouteCandidateResponse[]> {
    const searchParameters = new URLSearchParams({
        fromAirportId: fromAirportId.toString(),
        limit: "30"
    });

    if (toAirportId !== null) {
        searchParameters.set("toAirportId", toAirportId.toString());
    }

    return await sendRequest<ManagementRouteCandidateResponse[]>(
        `/departures/my/${departureId}/route-candidates?${searchParameters.toString()}`,
        "GET",
        undefined,
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

export async function addUserDeparturePassenger(
    departureId: number,
    personId: number
): Promise<void> {
    await sendRequest<void>(
        `/departures/my/${departureId}/passengers`,
        "POST",
        { personId }
    );
}

export async function removeUserDeparturePassenger(
    departureId: number,
    personId: number
): Promise<void> {
    await sendRequest<void>(
        `/departures/my/${departureId}/passengers/${personId}`,
        "DELETE"
    );
}
