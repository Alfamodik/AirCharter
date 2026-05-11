const apiBaseUrl = "https://localhost:7219";

export async function sendRequest<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers ?? {})
        },
        ...init
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Request failed.");
    }

    if (response.status === 204) {
        return undefined as TResponse;
    }

    return response.json() as Promise<TResponse>;
}