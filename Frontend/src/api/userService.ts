import { sendRequest } from "./sendRequest";
import type { UserProfileResponse } from "../contracts/responses/users/userProfileResponse";

export async function getCurrentUser(): Promise<UserProfileResponse> {
    return await sendRequest<UserProfileResponse>("/users/me", "GET");
}