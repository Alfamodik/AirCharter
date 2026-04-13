import { sendRequest } from "./sendRequest";
import type { MyDepartureResponse } from "../contracts/responses/users/myDepartureResponse";
import type { UserProfileResponse } from "../contracts/responses/users/userPersonResponse";

export async function getCurrentUser(signal?: AbortSignal): Promise<UserProfileResponse> {
    return await sendRequest<UserProfileResponse>("/users/me", "GET", undefined, signal);
}

export async function getUserDepartures(signal?: AbortSignal): Promise<MyDepartureResponse[]> {
    return await sendRequest<MyDepartureResponse[]>("/users/me/departures", "GET", undefined, signal);
}