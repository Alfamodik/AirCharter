// TypeScript-тип confirmEmailRequest описывает форму данных, которые frontend отправляет backend при запросе.

export type ConfirmEmailRequest = {
    email: string;
    code: string;
};