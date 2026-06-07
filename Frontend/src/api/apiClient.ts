// Базовый API-клиент хранит общий адрес backend и добавляет авторизацию к HTTP-запросам.

import { createApiError } from "./utils/apiError";

const apiBaseUrl = "https://localhost:7219";

export async function sendRequest<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
    let response: Response;

    try {
        response = await fetch(`${apiBaseUrl}${path}`, {
            headers: {
                "Content-Type": "application/json",
                ...(init?.headers ?? {})
            },
            ...init
        });
    } catch {
        throw createApiError(0);
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw createApiError(response.status, errorText);
    }

    if (response.status === 204) {
        return undefined as TResponse;
    }

    try {
        return await response.json() as TResponse;
    } catch {
        throw createApiError(response.status);
    }
}
