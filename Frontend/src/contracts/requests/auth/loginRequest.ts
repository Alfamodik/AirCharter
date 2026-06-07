// TypeScript-тип loginRequest описывает форму данных, которые frontend отправляет backend при запросе.

export type LoginRequest = {
    email: string;
    password: string;
};