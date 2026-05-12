import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { registerAirline, type RegisterAirlineRequest } from "../../api/airlineService";
import Header from "../../components/header/Header";
import InputField from "../../components/inputField/InputField";
import { useUser } from "../../context/UserContext";
import "./AirlineProfilePage.css";

const emptyForm: RegisterAirlineRequest = {
    airlineName: "",
    organizationFullName: "",
    organizationShortName: "",
    legalAddress: "",
    postalAddress: "",
    phoneNumber: "",
    email: "",
    serviceBaseCost: null,
    transferBaseCost: null,
    bankName: "",
    taxpayerId: "",
    taxRegistrationReasonCode: "",
    primaryStateRegistrationNumber: "",
    currentAccountNumber: "",
    correspondentAccountNumber: "",
    bankIdentifierCode: "",
    contractCity: "",
    contractValidityDays: 30,
    paymentDeadlineDays: 3,
    cateringClass: "",
    passengerArrivalMinutesBeforeFlight: 60
};

export default function RegisterAirlinePage() {
    const navigate = useNavigate();
    const { user, isLoading: isUserLoading, refreshUser } = useUser();
    const [formData, setFormData] = useState<RegisterAirlineRequest>(emptyForm);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    if (isUserLoading) {
        return <div className="auth-page"><div className="auth-title">Загрузка...</div></div>;
    }

    if (user === null) {
        return <Navigate to="/login" replace />;
    }

    if (user.airlineId !== null && user.airlineId !== undefined) {
        return <Navigate to="/airline-profile" replace />;
    }

    function updateField(name: keyof RegisterAirlineRequest, value: string) {
        setFormData((currentData) => ({
            ...currentData,
            [name]: isNumericField(name)
                ? (value === "" ? null : Number(value))
                : value
        }));
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setIsSaving(true);
        setErrorMessage("");

        try {
            const response = await registerAirline(sanitizeFormData(formData));
            localStorage.setItem("accessToken", response.token);
            await refreshUser();
            navigate("/airline-profile", { replace: true });
        } catch (error: unknown) {
            setErrorMessage(getApiErrorMessage(error, "Не удалось зарегистрировать авиакомпанию."));
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="catalog-wrapper">
            <Header showSearch={false}>
                <button className="header-icon-btn" onClick={() => navigate(-1)} title="Назад">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                </button>
            </Header>

            <div className="airline-profile-scroll">
                <main className="airline-profile-card">
                    <form onSubmit={handleSubmit} className="airline-profile-form">
                        <section className="airline-profile-section">
                            <h2>Регистрация авиакомпании</h2>
                            <div className="airline-profile-grid">
                                <InputField label="Название" value={formData.airlineName} onChange={(value) => updateField("airlineName", value)} required />
                                <InputField label="Полное наименование" value={formData.organizationFullName} onChange={(value) => updateField("organizationFullName", value)} required />
                                <InputField label="Краткое наименование" value={formData.organizationShortName} onChange={(value) => updateField("organizationShortName", value)} required />
                                <InputField label="Email" type="email" value={formData.email} onChange={(value) => updateField("email", value)} required />
                                <InputField label="Телефон" value={formData.phoneNumber} onChange={(value) => updateField("phoneNumber", value)} required />
                                <InputField label="Базовая стоимость обслуживания" type="number" min="0.01" step="0.01" value={formData.serviceBaseCost?.toString() ?? ""} onChange={(value) => updateField("serviceBaseCost", value)} required />
                                <InputField label="Базовая стоимость пересадки" type="number" min="0.01" step="0.01" value={formData.transferBaseCost?.toString() ?? ""} onChange={(value) => updateField("transferBaseCost", value)} required />
                            </div>
                        </section>

                        <section className="airline-profile-section">
                            <h2>Адреса и реквизиты</h2>
                            <div className="airline-profile-grid">
                                <InputField label="Юридический адрес" value={formData.legalAddress} onChange={(value) => updateField("legalAddress", value)} required />
                                <InputField label="Почтовый адрес" value={formData.postalAddress} onChange={(value) => updateField("postalAddress", value)} required />
                                <InputField label="ИНН" value={formData.taxpayerId} onChange={(value) => updateField("taxpayerId", value.replace(/\D/g, ""))} required maxLength={12} />
                                <InputField label="КПП" value={formData.taxRegistrationReasonCode} onChange={(value) => updateField("taxRegistrationReasonCode", value.replace(/\D/g, ""))} required maxLength={9} />
                                <InputField label="ОГРН" value={formData.primaryStateRegistrationNumber} onChange={(value) => updateField("primaryStateRegistrationNumber", value.replace(/\D/g, ""))} required maxLength={15} />
                                <InputField label="Банк" value={formData.bankName} onChange={(value) => updateField("bankName", value)} required />
                                <InputField label="Расчётный счёт" value={formData.currentAccountNumber} onChange={(value) => updateField("currentAccountNumber", value.replace(/\D/g, ""))} required maxLength={20} />
                                <InputField label="Корреспондентский счёт" value={formData.correspondentAccountNumber} onChange={(value) => updateField("correspondentAccountNumber", value.replace(/\D/g, ""))} required maxLength={20} />
                                <InputField label="БИК" value={formData.bankIdentifierCode} onChange={(value) => updateField("bankIdentifierCode", value.replace(/\D/g, ""))} required maxLength={9} />
                            </div>
                        </section>

                        <section className="airline-profile-section">
                            <h2>Условия договора</h2>
                            <div className="airline-profile-grid">
                                <InputField label="Город договора" value={formData.contractCity ?? ""} onChange={(value) => updateField("contractCity", value)} required />
                                <InputField label="Срок договора, дней" type="number" min="1" value={formData.contractValidityDays?.toString() ?? ""} onChange={(value) => updateField("contractValidityDays", value)} required />
                                <InputField label="Срок оплаты, дней" type="number" min="1" value={formData.paymentDeadlineDays?.toString() ?? ""} onChange={(value) => updateField("paymentDeadlineDays", value)} required />
                                <InputField label="Прибытие пассажиров, минут" type="number" min="1" value={formData.passengerArrivalMinutesBeforeFlight?.toString() ?? ""} onChange={(value) => updateField("passengerArrivalMinutesBeforeFlight", value)} required />
                                <InputField label="Класс бортпитания" value={formData.cateringClass ?? ""} onChange={(value) => updateField("cateringClass", value)} required />
                            </div>
                        </section>

                        {errorMessage && <div className="form-message error">{errorMessage}</div>}

                        <div className="airline-profile-actions">
                            <button type="submit" className="auth-submit-button" disabled={isSaving}>
                                {isSaving ? "Регистрация..." : "Зарегистрировать"}
                            </button>
                        </div>
                    </form>
                </main>
            </div>
        </div>
    );
}

function sanitizeFormData(formData: RegisterAirlineRequest): RegisterAirlineRequest {
    return {
        ...formData,
        airlineName: formData.airlineName.trim(),
        organizationFullName: formData.organizationFullName.trim(),
        organizationShortName: formData.organizationShortName.trim(),
        legalAddress: formData.legalAddress.trim(),
        postalAddress: formData.postalAddress.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        email: formData.email.trim(),
        bankName: formData.bankName.trim(),
        taxpayerId: formData.taxpayerId.trim(),
        taxRegistrationReasonCode: formData.taxRegistrationReasonCode.trim(),
        primaryStateRegistrationNumber: formData.primaryStateRegistrationNumber.trim(),
        currentAccountNumber: formData.currentAccountNumber.trim(),
        correspondentAccountNumber: formData.correspondentAccountNumber.trim(),
        bankIdentifierCode: formData.bankIdentifierCode.trim(),
        contractCity: formData.contractCity?.trim() || null,
        cateringClass: formData.cateringClass?.trim() || null
    };
}

function isNumericField(name: keyof RegisterAirlineRequest): boolean {
    return name === "contractValidityDays" ||
        name === "paymentDeadlineDays" ||
        name === "passengerArrivalMinutesBeforeFlight" ||
        name === "serviceBaseCost" ||
        name === "transferBaseCost";
}

function getApiErrorMessage(error: unknown, fallback: string): string {
    if (typeof error === "object" && error !== null && "message" in error) {
        const message = error.message;

        if (typeof message === "string" && message.trim() !== "") {
            return message.trim();
        }
    }

    return fallback;
}
