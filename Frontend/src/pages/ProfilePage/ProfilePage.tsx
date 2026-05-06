import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyPerson, updateMyPerson } from "../../api/personService";
import { getUpdateProfileErrorMessage } from "../../api/utils/authErrorMessages";
import Header from "../../components/header/Header";
import InputField from "../../components/inputField/InputField";
import type { ProfileFormData } from "../../contracts/responses/persons/profileFormData";
import "./ProfilePage.css";

const emptyProfileFormData: ProfileFormData = {
    firstName: "",
    lastName: "",
    patronymic: "",
    passportSeries: "",
    passportNumber: "",
    email: "",
    birthDate: "",
    registrationAddress: "",
    actualAddress: "",
    phoneNumber: "",
    taxpayerId: "",
    bankName: "",
    currentAccountNumber: "",
    correspondentAccountNumber: null,
    bankIdentifierCode: ""
};

export default function ProfilePage() {
    const navigate = useNavigate();
    const today = new Date().toISOString().split("T")[0];

    const [initialData, setInitialData] = useState<ProfileFormData | null>(null);
    const [formData, setFormData] = useState<ProfileFormData>(emptyProfileFormData);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

    useEffect(() => {
        void loadPersonData();
    }, []);

    async function loadPersonData() {
        try {
            const person = await getMyPerson();

            const data: ProfileFormData = {
                firstName: person.firstName,
                lastName: person.lastName,
                patronymic: person.patronymic ?? "",
                passportSeries: person.passportSeries ?? "",
                passportNumber: person.passportNumber ?? "",
                email: person.email ?? "",
                birthDate: person.birthDate ? person.birthDate.toString().split("T")[0] : "",
                registrationAddress: person.registrationAddress ?? "",
                actualAddress: person.actualAddress ?? "",
                phoneNumber: person.phoneNumber ?? "",
                taxpayerId: person.taxpayerId ?? "",
                bankName: person.bankName ?? "",
                currentAccountNumber: person.currentAccountNumber ?? "",
                correspondentAccountNumber: null,
                bankIdentifierCode: person.bankIdentifierCode ?? ""
            };

            setFormData(data);
            setInitialData(data);
            setStatusMessage(null);
        } catch (error: unknown) {
            if (isApiErrorWithStatus(error, 404)) {
                setFormData(emptyProfileFormData);
                setInitialData(emptyProfileFormData);
                setStatusMessage(null);
                return;
            }

            setStatusMessage({ text: "Ошибка загрузки профиля", type: "error" });
        } finally {
            setIsLoading(false);
        }
    }

    const isChanged = JSON.stringify(initialData) !== JSON.stringify(formData);

    function updateField(name: keyof ProfileFormData, value: string) {
        setFormData((currentData) => ({ ...currentData, [name]: value }));
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();

        if (!isChanged || isSaving) {
            return;
        }

        if (formData.birthDate && new Date(formData.birthDate) > new Date()) {
            setStatusMessage({ text: "Дата рождения не может быть в будущем", type: "error" });
            return;
        }

        const sanitizedData: ProfileFormData = {
            ...formData,
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            patronymic: formData.patronymic?.trim() || null,
            email: formData.email?.trim() || null,
            birthDate: formData.birthDate || null,
            registrationAddress: formData.registrationAddress?.trim() || null,
            actualAddress: formData.actualAddress?.trim() || null,
            phoneNumber: formData.phoneNumber?.trim() || null,
            taxpayerId: formData.taxpayerId?.trim() || null,
            bankName: formData.bankName?.trim() || null,
            currentAccountNumber: formData.currentAccountNumber?.trim() || null,
            correspondentAccountNumber: null,
            bankIdentifierCode: formData.bankIdentifierCode?.trim() || null
        };

        setIsSaving(true);
        setStatusMessage(null);

        try {
            await updateMyPerson(sanitizedData);
            setFormData(sanitizedData);
            setInitialData(sanitizedData);
            setStatusMessage({ text: "Изменения сохранены", type: "success" });
        } catch (error: unknown) {
            setStatusMessage({ text: getUpdateProfileErrorMessage(error), type: "error" });
        } finally {
            setIsSaving(false);
        }
    }

    if (isLoading) {
        return <div className="auth-page"><div className="auth-title">Загрузка...</div></div>;
    }

    return (
        <div className="catalog-wrapper">
            <Header showSearch={false}>
                <button
                    className="header-icon-btn"
                    onClick={() => navigate(-1)}
                    title="Назад"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                </button>
            </Header>

            <div className="profile-scroll-container">
                <div className="profile-content-card">
                    <h1 className="auth-title">Профиль</h1>

                    <form onSubmit={handleSubmit} className="auth-form">
                        <InputField label="Фамилия" value={formData.lastName} onChange={(value) => updateField("lastName", value)} required />
                        <InputField label="Имя" value={formData.firstName} onChange={(value) => updateField("firstName", value)} required />
                        <InputField label="Отчество" value={formData.patronymic ?? ""} onChange={(value) => updateField("patronymic", value)} />

                        <div className="passport-row">
                            <InputField label="Серия" value={formData.passportSeries} onChange={(value) => updateField("passportSeries", value.replace(/\D/g, ""))} maxLength={4} required />
                            <InputField label="Номер" value={formData.passportNumber} onChange={(value) => updateField("passportNumber", value.replace(/\D/g, ""))} maxLength={6} required />
                        </div>

                        <InputField label="Дата рождения" type="date" value={formData.birthDate ?? ""} max={today} onChange={(value) => updateField("birthDate", value)} />
                        <InputField label="Email для связи" type="email" value={formData.email ?? ""} onChange={(value) => updateField("email", value)} />
                        <InputField label="Адрес регистрации" value={formData.registrationAddress ?? ""} onChange={(value) => updateField("registrationAddress", value)} maxLength={255} />
                        <InputField label="Фактический адрес" value={formData.actualAddress ?? ""} onChange={(value) => updateField("actualAddress", value)} maxLength={255} />
                        <InputField label="Телефон" value={formData.phoneNumber ?? ""} onChange={(value) => updateField("phoneNumber", value)} maxLength={20} />
                        <InputField label="ИНН" value={formData.taxpayerId ?? ""} onChange={(value) => updateField("taxpayerId", value.replace(/\D/g, ""))} maxLength={12} />
                        <InputField label="Банк" value={formData.bankName ?? ""} onChange={(value) => updateField("bankName", value)} maxLength={100} />
                        <InputField label="Счёт" value={formData.currentAccountNumber ?? ""} onChange={(value) => updateField("currentAccountNumber", value.replace(/\D/g, ""))} maxLength={20} />
                        <InputField label="БИК" value={formData.bankIdentifierCode ?? ""} onChange={(value) => updateField("bankIdentifierCode", value.replace(/\D/g, ""))} maxLength={9} />

                        {statusMessage && (
                            <div className={`form-message ${statusMessage.type}`}>
                                {statusMessage.text}
                            </div>
                        )}

                        <div className="auth-actions">
                            <button
                                type="submit"
                                className="auth-submit-button"
                                disabled={!isChanged || isSaving}
                            >
                                {isSaving ? "Сохранение..." : "Сохранить"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

function isApiErrorWithStatus(error: unknown, status: number): boolean {
    return typeof error === "object" &&
        error !== null &&
        "status" in error &&
        error.status === status;
}
