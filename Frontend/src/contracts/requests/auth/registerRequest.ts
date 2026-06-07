// TypeScript-тип registerRequest описывает форму данных, которые frontend отправляет backend при запросе.

export type RegisterRequest = {
    email: string;
    password: string;
};