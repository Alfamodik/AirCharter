import { sendRequest } from "./sendRequest";
import type { UserPersonResponse } from "../contracts/responses/users/userPersonResponse";
import type { MyDepartureResponse } from "../contracts/responses/users/myDepartureResponse";

export async function getCurrentUser(): Promise<UserPersonResponse> {
    return await sendRequest<UserPersonResponse>("/users/me", "GET");
}

export async function getUserDepartures(): Promise<MyDepartureResponse[]> {
    return await sendRequest<MyDepartureResponse[]>("/users/me/departures", "GET");
}