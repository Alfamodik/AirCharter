import type { ApiError } from "../utils/apiError";

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

export function getUpdateProfileErrorMessage(error: unknown): string {
    const apiError = getApiError(error);

    if (apiError === null) {
        return "Не удалось сохранить данные.";
    }

    switch (apiError.status) {
        case 400:
            return getUpdateProfileBadRequestMessage(apiError.message);

        case 401:
            return "Сессия истекла. Пожалуйста, войдите снова.";

        case 409:
            return "Человек с такими паспортными данными уже зарегистрирован.";

        default:
            return "Не удалось сохранить данные.";
    }
}

function getUpdateProfileBadRequestMessage(message?: string): string {
    switch (message) {
        case "First name is required.":
            return "Имя обязательно для заполнения.";

        case "Last name is required.":
            return "Фамилия обязательна для заполнения.";

        case "Passport series is required.":
            return "Серия паспорта обязательна.";

        case "Passport number is required.":
            return "Номер паспорта обязателен.";

        case "Passport series must contain digits only.":
            return "Серия паспорта должна состоять только из цифр.";

        case "Passport number must contain digits only.":
            return "Номер паспорта должен состоять только из цифр.";

        case "Passport series must contain 4 digits.":
            return "Серия паспорта должна содержать 4 цифры.";

        case "Passport number must contain 6 digits.":
            return "Номер паспорта должен содержать 6 цифр.";

        default:
            return message || "Некорректные данные.";
    }
}