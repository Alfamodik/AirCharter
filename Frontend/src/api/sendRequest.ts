// Общая функция отправки запросов скрывает повторяющуюся работу с fetch, JSON, токеном и ошибками.

import { createApiError } from "./utils/apiError";

const apiBaseUrl = "https://localhost:7219";
export const unauthorizedResponseEventName = "aircharter:unauthorized-response";

type AccessTokenResponse = {
    token: string;
};

let refreshAccessTokenRequest: Promise<string | null> | null = null;

export async function sendRequest<TResponse>(
    path: string,
    method: string,
    body?: unknown,
    signal?: AbortSignal
): Promise<TResponse> {
    const accessToken = localStorage.getItem("accessToken");
    const response = await sendFetchRequest(path, method, body, signal, accessToken);

    if (response.ok) {
        return await parseResponse<TResponse>(response);
    }

    // Если access-токен устарел, frontend пробует обновить его через refresh-cookie и повторить исходный запрос один раз.
    if ((response.status === 401 || response.status === 403) && accessToken && !isAuthEndpoint(path)) {
        const refreshedAccessToken = await refreshAccessToken();

        if (refreshedAccessToken !== null) {
            const retryResponse = await sendFetchRequest(
                path,
                method,
                body,
                signal,
                refreshedAccessToken
            );

            if (retryResponse.ok) {
                return await parseResponse<TResponse>(retryResponse);
            }

            if (retryResponse.status === 401) {
                handleUnauthorizedResponse();
            }

            const retryResponseText = await retryResponse.text();
            throw createApiError(retryResponse.status, retryResponseText);
        }

        handleUnauthorizedResponse();
    }

    const responseText = await response.text();
    throw createApiError(response.status, responseText);
}

export async function sendBlobRequest(
    path: string,
    method: string,
    body?: unknown,
    signal?: AbortSignal
): Promise<Blob> {
    const accessToken = localStorage.getItem("accessToken");
    const response = await sendFetchRequest(path, method, body, signal, accessToken);

    if (response.ok) {
        return await response.blob();
    }

    if ((response.status === 401 || response.status === 403) && accessToken && !isAuthEndpoint(path)) {
        const refreshedAccessToken = await refreshAccessToken();

        if (refreshedAccessToken !== null) {
            const retryResponse = await sendFetchRequest(
                path,
                method,
                body,
                signal,
                refreshedAccessToken
            );

            if (retryResponse.ok) {
                return await retryResponse.blob();
            }

            if (retryResponse.status === 401) {
                handleUnauthorizedResponse();
            }

            const retryResponseText = await retryResponse.text();
            throw createApiError(retryResponse.status, retryResponseText);
        }

        handleUnauthorizedResponse();
    }

    const responseText = await response.text();
    throw createApiError(response.status, responseText);
}

export async function sendFormDataRequest<TResponse>(
    path: string,
    method: string,
    body: FormData,
    signal?: AbortSignal
): Promise<TResponse> {
    const accessToken = localStorage.getItem("accessToken");
    const response = await sendFetchFormDataRequest(path, method, body, signal, accessToken);

    if (response.ok) {
        return await parseResponse<TResponse>(response);
    }

    const responseText = await response.text();
    throw createApiError(response.status, responseText);
}

async function sendFetchRequest(
    path: string,
    method: string,
    body: unknown,
    signal: AbortSignal | undefined,
    accessToken: string | null
): Promise<Response> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json"
    };

    if (accessToken && !isAuthEndpoint(path)) {
        headers["Authorization"] = `Bearer ${accessToken}`;
    }

    try {
        return await fetch(`${apiBaseUrl}${path}`, {
            method: method,
            headers: headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: signal,
            credentials: "include"
        });
    } catch {
        throw createApiError(0);
    }
}

async function sendFetchFormDataRequest(
    path: string,
    method: string,
    body: FormData,
    signal: AbortSignal | undefined,
    accessToken: string | null
): Promise<Response> {
    const headers: Record<string, string> = {};

    if (accessToken && !isAuthEndpoint(path)) {
        headers["Authorization"] = `Bearer ${accessToken}`;
    }

    try {
        return await fetch(`${apiBaseUrl}${path}`, {
            method: method,
            headers: headers,
            body: body,
            signal: signal,
            credentials: "include"
        });
    } catch {
        throw createApiError(0);
    }
}

async function parseResponse<TResponse>(response: Response): Promise<TResponse> {
    if (response.status === 204) {
        return undefined as TResponse;
    }

    try {
        return await response.json() as TResponse;
    } catch {
        throw createApiError(response.status);
    }
}

async function refreshAccessToken(): Promise<string | null> {
    // Одна общая Promise защищает от пачки одновременных запросов /auth/refresh при массовом 401.
    refreshAccessTokenRequest ??= requestFreshAccessToken()
        .finally(() => {
            refreshAccessTokenRequest = null;
        });

    return await refreshAccessTokenRequest;
}

async function requestFreshAccessToken(): Promise<string | null> {
    try {
        const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include"
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json() as AccessTokenResponse;

        localStorage.setItem("accessToken", data.token);

        return data.token;
    } catch {
        return null;
    }
}

function handleUnauthorizedResponse() {
    // Событие нужно, чтобы слой API не зависел напрямую от React Router и контекстов.
    localStorage.removeItem("accessToken");
    window.dispatchEvent(new CustomEvent(unauthorizedResponseEventName));
}

function isAuthEndpoint(path: string): boolean {
    return path.startsWith("/auth/");
}
