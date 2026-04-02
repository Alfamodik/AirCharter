import type { ApiError } from "./apiError";

export function getRegisterErrorMessage(error: unknown): string {
    const apiError = getApiError(error);

    if (apiError === null) {
        return "Не удалось зарегистрироваться.";
    }

    switch (apiError.status) {
        case 400:
            return getRegisterBadRequestMessage(apiError.message);

        case 409:
            return "Пользователь с такой почтой уже существует.";

        default:
            return "Не удалось зарегистрироваться.";
    }
}

export function getLoginErrorMessage(error: unknown): string {
    const apiError = getApiError(error);

    if (apiError === null) {
        return "Не удалось выполнить вход.";
    }

    switch (apiError.status) {
        case 400:
            return getLoginBadRequestMessage(apiError.message);

        case 401:
            return "Неверная почта или пароль.";

        case 403:
            return "Пользователь заблокирован.";

        default:
            return "Не удалось выполнить вход.";
    }
}

export function getConfirmEmailErrorMessage(error: unknown): string {
    const apiError = getApiError(error);

    if (apiError === null) {
        return "Не удалось подтвердить почту.";
    }

    switch (apiError.status) {
        case 400:
            return getConfirmEmailBadRequestMessage(apiError.message);

        case 404:
            return "Пользователь не найден.";

        default:
            return "Не удалось подтвердить почту.";
    }
}

export function getResendCodeErrorMessage(error: unknown): string {
    const apiError = getApiError(error);

    if (apiError === null) {
        return "Не удалось отправить код повторно.";
    }

    switch (apiError.status) {
        case 400:
            return getResendCodeBadRequestMessage(apiError.message);

        case 404:
            return "Пользователь не найден.";

        default:
            return "Не удалось отправить код повторно.";
    }
}

function getApiError(error: unknown): ApiError | null {
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

function getRegisterBadRequestMessage(message?: string): string {
    switch (message) {
        case "Email is required.":
            return "Укажите почту.";

        case "Password is required.":
            return "Укажите пароль.";

        default:
            return "Некорректные данные для регистрации.";
    }
}

function getLoginBadRequestMessage(message?: string): string {
    switch (message) {
        case "Email is required.":
            return "Укажите почту.";

        case "Password is required.":
            return "Укажите пароль.";

        case "Email is not confirmed.":
            return "Почта не подтверждена.";

        default:
            return "Не удалось выполнить вход.";
    }
}

function getConfirmEmailBadRequestMessage(message?: string): string {
    switch (message) {
        case "Email is required.":
            return "Укажите почту.";

        case "Code is required.":
            return "Укажите код подтверждения.";

        case "Email is already confirmed.":
            return "Почта уже подтверждена.";

        case "Confirmation code not found.":
            return "Код подтверждения не найден.";

        case "Confirmation code expiration not found.":
            return "Срок действия кода не найден.";

        case "Confirmation code expired.":
            return "Срок действия кода истёк.";

        case "Invalid confirmation code.":
            return "Неверный код подтверждения.";

        default:
            return "Не удалось подтвердить почту.";
    }
}

function getResendCodeBadRequestMessage(message?: string): string {
    switch (message) {
        case "Email is required.":
            return "Укажите почту.";

        case "Email is already confirmed.":
            return "Почта уже подтверждена.";

        default:
            return "Не удалось отправить код повторно.";
    }
}