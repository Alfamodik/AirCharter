import { sendRequest } from "./sendRequest";
import type { AccessTokenResponse } from "../contracts/responses/auth/accessTokenResponse";

export interface NotificationResponse {
    id: number;
    title: string;
    message: string;
    actionType?: string | null;
    createdAtUtc: string;
    readAtUtc?: string | null;
}

export async function getMyNotifications(signal?: AbortSignal): Promise<NotificationResponse[]> {
    return await sendRequest<NotificationResponse[]>(
        "/users/me/notifications",
        "GET",
        undefined,
        signal
    );
}

export async function markMyNotificationAsRead(notificationId: number): Promise<void> {
    await sendRequest<void>(
        `/users/me/notifications/${notificationId}/read`,
        "POST"
    );
}

export async function markMyNotificationsAsRead(): Promise<void> {
    await sendRequest<void>(
        "/users/me/notifications/read-all",
        "POST"
    );
}

export async function acceptAirlineEmploymentInvitation(notificationId: number): Promise<AccessTokenResponse> {
    return await sendRequest<AccessTokenResponse>(
        `/users/me/notifications/${notificationId}/accept-airline-employment`,
        "POST"
    );
}
