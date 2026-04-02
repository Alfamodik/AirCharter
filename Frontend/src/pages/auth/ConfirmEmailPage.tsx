import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import InputField from "../../components/InputField/InputField";
import {
    confirmEmail,
    resendEmailConfirmationCode
} from "../../api/authService";
import {
    getConfirmEmailErrorMessage,
    getResendCodeErrorMessage
} from "../../api/authErrorMessages";
import "./auth-page.css";

type ConfirmEmailLocationState = {
    email?: string;
};

export default function ConfirmEmailPage() {
    const navigate = useNavigate();
    const location = useLocation();

    const state = location.state as ConfirmEmailLocationState | null;
    const initialEmail = state?.email ?? "";

    const [email, setEmail] = useState(initialEmail);
    const [code, setCode] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isResending, setIsResending] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setErrorMessage("");
        setSuccessMessage("");

        const trimmedEmail = email.trim();
        const trimmedCode = code.trim();

        if (trimmedEmail === "") {
            setErrorMessage("Укажите почту.");
            return;
        }

        if (trimmedCode === "") {
            setErrorMessage("Укажите код подтверждения.");
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await confirmEmail({
                email: trimmedEmail,
                code: trimmedCode
            });

            localStorage.setItem("accessToken", response.token);
            navigate("/");
        } catch (error) {
            setErrorMessage(getConfirmEmailErrorMessage(error));
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleResendCodeClick() {
        setErrorMessage("");
        setSuccessMessage("");

        const trimmedEmail = email.trim();

        if (trimmedEmail === "") {
            setErrorMessage("Укажите почту.");
            return;
        }

        setIsResending(true);

        try {
            await resendEmailConfirmationCode({
                email: trimmedEmail
            });

            setSuccessMessage("Новый код отправлен на почту.");
        } catch (error) {
            setErrorMessage(getResendCodeErrorMessage(error));
        } finally {
            setIsResending(false);
        }
    }

    function handleBackClick() {
        navigate("/register");
    }

    return (
        <div className="auth-page">
            <section className="auth-card auth-card-register">
                <h1 className="auth-title">Подтверждение почты</h1>

                <form className="auth-form" onSubmit={handleSubmit}>
                    <InputField
                        id="confirm-email"
                        label="Почта"
                        type="email"
                        value={email}
                        onChange={setEmail}
                    />

                    <InputField
                        id="confirm-code"
                        label="Код"
                        type="text"
                        value={code}
                        onChange={setCode}
                    />

                    {errorMessage !== "" && (
                        <p className="auth-error-message">{errorMessage}</p>
                    )}

                    {successMessage !== "" && (
                        <p className="auth-success-message">{successMessage}</p>
                    )}

                    <div className="auth-actions">
                        <button
                            type="button"
                            className="auth-link-button"
                            onClick={handleBackClick}
                        >
                            Назад
                        </button>

                        <button
                            type="button"
                            className="auth-link-button"
                            onClick={handleResendCodeClick}
                            disabled={isResending}
                        >
                            {isResending ? "Отправка..." : "Отправить код снова"}
                        </button>

                        <button
                            type="submit"
                            className="auth-submit-button"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Подтверждение..." : "Подтвердить"}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
}