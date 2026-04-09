import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import InputField from "../../components/InputField/InputField";
import { login } from "../../api/authService";
import { getLoginErrorMessage } from "../../api/utils/authErrorMessages";
import { useUser } from "../../context/UserContext"; // Импортируем контекст
import "./auth-page.css";

export default function LoginPage() {
    const navigate = useNavigate();
    const { refreshUser } = useUser(); // Получаем функцию обновления

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setErrorMessage("");

        const trimmedEmail = email.trim();

        if (trimmedEmail === "") {
            setErrorMessage("Укажите почту.");
            return;
        }

        if (password === "") {
            setErrorMessage("Укажите пароль.");
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await login({
                email: trimmedEmail,
                password: password
            });

            // 1. Сохраняем токен
            localStorage.setItem("accessToken", response.token);
            await refreshUser();
            navigate("/");
        } catch (error) {
            setErrorMessage(getLoginErrorMessage(error));
        } finally {
            setIsSubmitting(false);
        }
    }

    function handleRegisterClick() {
        navigate("/register");
    }

    function handleCatalogClick() {
        navigate("/");
    }

    return (
        <div className="auth-page">
            <button 
                type="button" 
                className="auth-back-button" 
                onClick={handleCatalogClick}
            >
                В каталог
            </button>

            <section className="auth-card">
                <h1 className="auth-title">Вход</h1>

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
                        type="password"
                        value={password}
                        onChange={setPassword}
                    />

                    {errorMessage !== "" && (
                        <p className="auth-error-message">{errorMessage}</p>
                    )}

                    <div className="auth-actions">
                        <button
                            type="button"
                            className="auth-link-button"
                            onClick={handleRegisterClick}
                        >
                            Регистрация
                        </button>

                        <button
                            type="submit"
                            className="auth-submit-button"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Вход..." : "Войти"}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
}