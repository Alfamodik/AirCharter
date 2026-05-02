import type { ApiError } from "./utils/apiError";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "https://localhost:7219";
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

    if (response.status === 401 && accessToken && !isAuthEndpoint(path)) {
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

    return await fetch(`${apiBaseUrl}${path}`, {
        method: method,
        headers: headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: signal,
        credentials: "include"
    });
}

async function parseResponse<TResponse>(response: Response): Promise<TResponse> {
    if (response.status === 204) {
        return undefined as TResponse;
    }

    return await response.json() as TResponse;
}

async function refreshAccessToken(): Promise<string | null> {
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
    localStorage.removeItem("accessToken");
    window.dispatchEvent(new CustomEvent(unauthorizedResponseEventName));
}

function isAuthEndpoint(path: string): boolean {
    return path.startsWith("/auth/");
}

function createApiError(status: number, responseText: string): ApiError {
    const trimmedResponseText = responseText.trim();

    if (trimmedResponseText === "") {
        return {
            status: status
        };
    }

    return {
        status: status,
        message: trimmedResponseText
    };
}
