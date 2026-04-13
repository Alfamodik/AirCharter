import type { ApiError } from "./utils/apiError";

const apiBaseUrl = "https://localhost:7219";

export async function sendRequest<TResponse>(
    path: string,
    method: string,
    body?: unknown,
    signal?: AbortSignal
): Promise<TResponse> {
    const accessToken = localStorage.getItem("accessToken");

    const headers: Record<string, string> = {
        "Content-Type": "application/json"
    };

    if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${apiBaseUrl}${path}`, {
        method: method,
        headers: headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: signal
    });

    if (response.ok) {
        if (response.status === 204) {
            return undefined as TResponse;
        }

        return await response.json() as TResponse;
    }

    const responseText = await response.text();
    throw createApiError(response.status, responseText);
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