// Утилита API apiError помогает сервисам frontend одинаково обрабатывать роли, ошибки и ответы backend.

export type ApiError = {
    status: number;
    message?: string;
};

export const defaultApiErrorMessage = "Что-то пошло не так. Попробуйте ещё раз чуть позже.";
export const networkApiErrorMessage = "Не удалось связаться с сервером. Проверьте интернет и попробуйте снова.";

export function getFriendlyApiErrorMessage(error: unknown, fallback = defaultApiErrorMessage): string {
    const apiError = getApiError(error);

    if (apiError !== null) {
        return getFriendlyApiErrorMessageFromStatus(apiError.status, apiError.message, fallback);
    }

    if (error instanceof Error && isUserSafeMessage(error.message)) {
        return error.message.trim();
    }

    return fallback;
}

export function createApiError(status: number, responseText = ""): ApiError {
    const message = normalizeApiErrorMessage(status, responseText);

    return message === undefined
        ? { status }
        : { status, message };
}

export function getApiError(error: unknown): ApiError | null {
    if (typeof error !== "object" || error === null) {
        return null;
    }

    if (!("status" in error) || typeof error.status !== "number") {
        return null;
    }

    if ("message" in error && typeof error.message === "string") {
        return {
            status: error.status,
            message: error.message
        };
    }

    return {
        status: error.status
    };
}

function normalizeApiErrorMessage(status: number, responseText: string): string | undefined {
    if (status <= 0) {
        return networkApiErrorMessage;
    }

    if (status >= 500) {
        return defaultApiErrorMessage;
    }

    const responseMessage = extractResponseMessage(responseText);

    if (isUserSafeMessage(responseMessage)) {
        return responseMessage.trim();
    }

    return getDefaultMessageForStatus(status);
}

function getFriendlyApiErrorMessageFromStatus(
    status: number,
    message: string | undefined,
    fallback: string
): string {
    if (isUserSafeMessage(message)) {
        return message.trim();
    }

    return getDefaultMessageForStatus(status) ?? fallback;
}

function getDefaultMessageForStatus(status: number): string | undefined {
    if (status <= 0) {
        return networkApiErrorMessage;
    }

    if (status === 401) {
        return "Сессия истекла. Войдите снова.";
    }

    if (status === 403) {
        return "У вас нет доступа к этому действию.";
    }

    if (status === 404) {
        return "Не удалось найти нужные данные. Обновите страницу и попробуйте снова.";
    }

    if (status >= 500) {
        return defaultApiErrorMessage;
    }

    return undefined;
}

function extractResponseMessage(responseText: string): string | undefined {
    const trimmedResponseText = responseText.trim();

    if (trimmedResponseText === "") {
        return undefined;
    }

    if (trimmedResponseText.startsWith("{")) {
        try {
            const parsedResponse = JSON.parse(trimmedResponseText) as unknown;
            const parsedMessage = extractJsonMessage(parsedResponse);

            if (parsedMessage !== undefined) {
                return parsedMessage;
            }
        } catch {
            return trimmedResponseText;
        }
    }

    return trimmedResponseText;
}

function extractJsonMessage(value: unknown): string | undefined {
    if (typeof value === "string") {
        return value;
    }

    if (typeof value !== "object" || value === null) {
        return undefined;
    }

    const response = value as Record<string, unknown>;

    if (typeof response.message === "string") {
        return response.message;
    }

    if (typeof response.detail === "string") {
        return response.detail;
    }

    if (typeof response.title === "string" &&
        response.title !== "One or more validation errors occurred.") {
        return response.title;
    }

    if (typeof response.errors === "object" && response.errors !== null) {
        const validationMessages = Object.values(response.errors as Record<string, unknown>)
            .flatMap((fieldErrors) => Array.isArray(fieldErrors)
                ? fieldErrors.filter((fieldError): fieldError is string => typeof fieldError === "string")
                : []);

        if (validationMessages.length > 0) {
            return validationMessages[0];
        }
    }

    return undefined;
}

function isUserSafeMessage(message: string | undefined): message is string {
    if (message === undefined) {
        return false;
    }

    const trimmedMessage = message.trim();

    if (trimmedMessage === "" || trimmedMessage.length > 500) {
        return false;
    }

    const hasLetters = /[A-Za-zА-Яа-яЁё]/u.test(trimmedMessage);
    const hasCyrillicLetters = /[А-Яа-яЁё]/u.test(trimmedMessage);

    if (hasLetters && !hasCyrillicLetters) {
        return false;
    }

    return ![
        "System.",
        "Microsoft.",
        "PdfSharp.",
        "MigraDoc.",
        "Exception",
        " at ",
        "HEADERS",
        "<!DOCTYPE",
        "<html",
        "stack trace",
        "traceId"
    ].some((technicalMarker) =>
        trimmedMessage.toLowerCase().includes(technicalMarker.toLowerCase()));
}
