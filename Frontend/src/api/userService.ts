import { sendRequest } from "./sendRequest";
import type { UserProfileResponse } from "../contracts/responses/users/userPersonResponse";
import type { UserDepartureResponse } from "../contracts/responses/users/userDepartureResponse";

export async function getCurrentUser(): Promise<UserProfileResponse> {
    return await sendRequest<UserProfileResponse>("/users/me", "GET");
}

export async function getUserDepartures(): Promise<UserDepartureResponse[]> {
    return await sendRequest<UserDepartureResponse[]>("/users/me/departures", "GET");
}