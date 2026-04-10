import { sendRequest } from "./sendRequest";
import type { UserPersonResponse } from "../contracts/responses/users/userPersonResponse";
import type { ProfileFormData } from "../contracts/responses/persons/profileFormData";

export async function getMyPerson(): Promise<UserPersonResponse> {
    return await sendRequest<UserPersonResponse>("/persons/me", "GET");
}

export async function updateMyPerson(data: ProfileFormData): Promise<UserPersonResponse> {
    return await sendRequest<UserPersonResponse>("/persons/me", "PUT", data);
}