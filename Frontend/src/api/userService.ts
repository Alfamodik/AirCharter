import { sendBlobRequest, sendFormDataRequest, sendRequest } from "./sendRequest";
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

export async function updateUserDepartureTakeOffDateTime(
    departureId: number,
    requestedTakeOffDateTime: string
): Promise<void> {
    await sendRequest<void>(
        `/departures/my/${departureId}/take-off-date-time`,
        "POST",
        { requestedTakeOffDateTime }
    );
}

export async function submitUserDeparture(departureId: number): Promise<void> {
    await sendRequest<void>(
        `/departures/my/${departureId}/submit`,
        "POST"
    );
}

export async function downloadUserDepartureTicket(departureId: number): Promise<Blob> {
    return await sendBlobRequest(
        `/departures/${departureId}/ticket`,
        "GET"
    );
}

export async function downloadDepartureContract(departureId: number): Promise<Blob> {
    return await sendBlobRequest(
        `/departures/${departureId}/contract`,
        "GET"
    );
}

export async function uploadDepartureContractDocument(
    departureId: number,
    file: File
): Promise<void> {
    const formData = new FormData();
    formData.append("file", file);

    await sendFormDataRequest<void>(
        `/departures/${departureId}/contract-document`,
        "POST",
        formData
    );
}

export async function downloadDepartureContractDocument(departureId: number): Promise<Blob> {
    return await sendBlobRequest(
        `/departures/${departureId}/contract-document`,
        "GET"
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
