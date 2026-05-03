import { sendRequest } from "./sendRequest";
import type { UserPersonResponse } from "../contracts/responses/users/userPersonResponse";
import type { ProfileFormData } from "../contracts/responses/persons/profileFormData";

export interface PassengerSearchResponse {
    id: number;
    fullName: string;
    email?: string | null;
}

export async function getMyPerson(): Promise<UserPersonResponse> {
    return await sendRequest<UserPersonResponse>("/persons/me", "GET");
}

export async function updateMyPerson(data: ProfileFormData): Promise<UserPersonResponse> {
    return await sendRequest<UserPersonResponse>("/persons/me", "PUT", data);
}

export async function searchPassengers(
    query: string,
    signal?: AbortSignal
): Promise<PassengerSearchResponse[]> {
    const searchParameters = new URLSearchParams({
        query,
        limit: "8"
    });

    return await sendRequest<PassengerSearchResponse[]>(
        `/persons/search?${searchParameters.toString()}`,
        "GET",
        undefined,
        signal
    );
}

export async function createPassenger(data: ProfileFormData): Promise<PassengerSearchResponse> {
    return await sendRequest<PassengerSearchResponse>("/persons", "POST", data);
}
