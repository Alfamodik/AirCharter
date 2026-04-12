import { sendRequest } from "./sendRequest";
import type { UserPersonResponse } from "../contracts/responses/users/UserPersonResponse";
import type { UserDepartureResponse } from "../contracts/responses/users/myDepartureResponse";

export async function getCurrentUser(): Promise<UserPersonResponse> {
    return await sendRequest<UserPersonResponse>("/users/me", "GET");
}

export async function getUserDepartures(): Promise<UserDepartureResponse[]> {
    return await sendRequest<UserDepartureResponse[]>("/users/me/departures", "GET");
}