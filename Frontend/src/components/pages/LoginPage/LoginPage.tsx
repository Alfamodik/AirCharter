import { useState } from "react";
import InputField from "../../InputField/InputField";
import "../auth-page.css";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    function togglePasswordVisibility() {
        setIsPasswordVisible(!isPasswordVisible);
    }

    function handleRegisterClick() {
    }

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
    }

    return (
        <div className="auth-page">
            <section className="auth-card auth-card-login">
                <h1 className="auth-title">Добро пожаловать</h1>

                <form className="auth-form" onSubmit={handleSubmit}>
                    <InputField
                        id="login-email"
                        label="Почта"
                        type="email"
                        value={email}
                        onChange={setEmail}
                    />

                    <InputField
                        id="login-password"
                        label="Пароль"
                        type={isPasswordVisible ? "text" : "password"}
                        value={password}
                        onChange={setPassword}
                        rightElement={
                            <button
                                type="button"
                                className="auth-password-toggle"
                                onClick={togglePasswordVisibility}
                                aria-label="Показать или скрыть пароль"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    className="auth-eye-icon"
                                    aria-hidden="true"
                                >
                                    <path
                                        d="M12 5C6.5 5 2.1 8.4 1 12c1.1 3.6 5.5 7 11 7s9.9-3.4 11-7c-1.1-3.6-5.5-7-11-7Zm0 11a4 4 0 1 1 0-8a4 4 0 0 1 0 8Zm0-2.2a1.8 1.8 0 1 0 0-3.6a1.8 1.8 0 0 0 0 3.6Z"
                                        fill="currentColor"
                                    />
                                </svg>
                            </button>
                        }
                    />

                    <div className="auth-actions">
                        <button
                            type="button"
                            className="auth-link-button"
                            onClick={handleRegisterClick}
                        >
                            Зарегистрироваться
                        </button>

                        <button
                            type="submit"
                            className="auth-submit-button"
                        >
                            Войти
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
}