import { useState } from "react";
import type { FormEvent } from "react";
import InputField from "../../InputField/InputField";
import "../auth-page.css";

export default function RegisterPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmedPassword, setConfirmedPassword] = useState("");

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
    }

    function handleLoginClick() {
    }

    return (
        <div className="auth-page">
            <section className="auth-card auth-card-register">
                <h1 className="auth-title">Регистрация</h1>

                <form className="auth-form" onSubmit={handleSubmit}>
                    <InputField
                        id="register-email"
                        label="Почта"
                        type="email"
                        value={email}
                        onChange={setEmail}
                    />

                    <InputField
                        id="register-password"
                        label="Пароль"
                        type="password"
                        value={password}
                        onChange={setPassword}
                    />

                    <InputField
                        id="register-confirmed-password"
                        label="Подтвердите пароль"
                        type="password"
                        value={confirmedPassword}
                        onChange={setConfirmedPassword}
                    />

                    <div className="auth-actions">
                        <button
                            type="button"
                            className="auth-link-button"
                            onClick={handleLoginClick}
                        >
                            Вход
                        </button>

                        <button
                            type="submit"
                            className="auth-submit-button"
                        >
                            Зарегистрироваться
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
}