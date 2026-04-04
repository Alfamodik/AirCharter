import type { ApiError } from "./utils/apiError";

const apiBaseUrl = "https://localhost:7219";

export async function sendRequest<TResponse>(
    path: string,
    method: string,
    body?: unknown
): Promise<TResponse> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
        method: method,
        headers: {
            "Content-Type": "application/json"
        },
        body: body === undefined ? undefined : JSON.stringify(body)
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