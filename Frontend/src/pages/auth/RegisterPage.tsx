import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import InputField from "../../components/InputField/InputField";
import { register } from "../../api/authService";
import { getRegisterErrorMessage } from "../../api//utils/authErrorMessages";
import "./auth-page.css";

export default function RegisterPage() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmedPassword, setConfirmedPassword] = useState("");
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

        if (password !== confirmedPassword) {
            setErrorMessage("Пароли не совпадают.");
            return;
        }

        setIsSubmitting(true);

        try {
            await register({
                email: trimmedEmail,
                password: password
            });

            navigate("/confirm-email", {
                state: {
                    email: trimmedEmail
                }
            });
        } catch (error) {
            setErrorMessage(getRegisterErrorMessage(error));
        } finally {
            setIsSubmitting(false);
        }
    }

    function handleLoginClick() {
        navigate("/login");
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

                    {errorMessage !== "" && (
                        <p className="auth-error-message">{errorMessage}</p>
                    )}

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
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Регистрация..." : "Зарегистрироваться"}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
}