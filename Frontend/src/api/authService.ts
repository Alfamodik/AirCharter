import type { ConfirmEmailRequest } from "../contracts/requests/auth/confirmEmailRequest";
import type { LoginRequest } from "../contracts/requests/auth/loginRequest";
import type { RegisterRequest } from "../contracts/requests/auth/registerRequest";
import type { ResendEmailConfirmationCodeRequest } from "../contracts/requests/auth/resendEmailConfirmationCodeRequest";
import type { AccessTokenResponse } from "../contracts/responses/auth/accessTokenResponse";
import { sendRequest } from "./sendRequest";

export async function register(request: RegisterRequest): Promise<void> {
    await sendRequest<void>("/auth/register", "POST", request);
}

export async function login(request: LoginRequest): Promise<AccessTokenResponse> {
    return await sendRequest<AccessTokenResponse>("/auth/login", "POST", request);
}

export async function confirmEmail(request: ConfirmEmailRequest): Promise<AccessTokenResponse> {
    return await sendRequest<AccessTokenResponse>("/auth/confirm-email", "POST", request);
}

export async function resendEmailConfirmationCode(
    request: ResendEmailConfirmationCodeRequest
): Promise<void> {
    await sendRequest<void>("/auth/resend-email-confirmation-code", "POST", request);
}