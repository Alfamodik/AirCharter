import React, { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
    getMyAirlineContractSettings,
    updateMyAirlineContractSettings,
    updateMyAirlineImage,
    type AirlineContractSettingsResponse,
    type UpdateAirlineContractSettingsRequest
} from "../../api/airlineService";
import { hasAirlineProfileAccess } from "../../api/utils/roleAccess";
import Header from "../../components/header/Header";
import InputField from "../../components/inputField/InputField";
import { useUser } from "../../context/UserContext";
import "./AirlineProfilePage.css";

const emptyAirlineFormData: UpdateAirlineContractSettingsRequest = {
    airlineName: "",
    organizationFullName: "",
    organizationShortName: "",
    legalAddress: "",
    postalAddress: "",
    phoneNumber: "",
    email: "",
    bankName: "",
    taxpayerId: "",
    taxRegistrationReasonCode: "",
    primaryStateRegistrationNumber: "",
    currentAccountNumber: "",
    correspondentAccountNumber: "",
    bankIdentifierCode: "",
    contractCity: "",
    contractValidityDays: null,
    paymentDeadlineDays: null,
    cateringClass: "",
    passengerArrivalMinutesBeforeFlight: null
};

export default function AirlineProfilePage() {
    const navigate = useNavigate();
    const { user, isLoading: isUserLoading } = useUser();
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [initialData, setInitialData] = useState<UpdateAirlineContractSettingsRequest | null>(null);
    const [formData, setFormData] = useState<UpdateAirlineContractSettingsRequest>(emptyAirlineFormData);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [pendingImageBase64, setPendingImageBase64] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

    const canOpenPage = !isUserLoading && hasAirlineProfileAccess(user?.role?.name) && user?.airlineId;

    useEffect(() => {
        if (!canOpenPage) {
            return;
        }

        void loadAirlineProfile();
    }, [canOpenPage]);

    const isChanged = useMemo(
        () => JSON.stringify(initialData) !== JSON.stringify(formData) || pendingImageBase64 !== null,
        [initialData, formData, pendingImageBase64]
    );

    async function loadAirlineProfile() {
        setIsLoading(true);
        setStatusMessage(null);

        try {
            const settings = await getMyAirlineContractSettings();
            const data = createFormData(settings);

            setFormData(data);
            setInitialData(data);
            setImageBase64(settings.imageBase64 ?? null);
            setPendingImageBase64(null);
        } catch {
            setStatusMessage({ text: "Не удалось загрузить профиль авиакомпании", type: "error" });
        } finally {
            setIsLoading(false);
        }
    }

    function updateField(name: keyof UpdateAirlineContractSettingsRequest, value: string) {
        setFormData((currentData) => ({
            ...currentData,
            [name]: isNumericField(name)
                ? (value === "" ? null : Number(value))
                : value
        }));
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();

        if (!isChanged || isSaving) {
            return;
        }

        setIsSaving(true);
        setStatusMessage(null);

        try {
            const response = await updateMyAirlineContractSettings(sanitizeFormData(formData));

            if (pendingImageBase64 !== null) {
                await updateMyAirlineImage(pendingImageBase64);
            }
            const savedData = createFormData(response);

            setFormData(savedData);
            setInitialData(savedData);
            setImageBase64(pendingImageBase64 ?? response.imageBase64 ?? imageBase64);
            setPendingImageBase64(null);
            setStatusMessage({ text: "Информация обновлена", type: "success" });
        } catch (error: unknown) {
            setStatusMessage({ text: getApiErrorMessage(error, "Не удалось сохранить профиль авиакомпании"), type: "error" });
        } finally {
            setIsSaving(false);
        }
    }

    async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        const dataUrl = await readFileAsDataUrl(file);

        setStatusMessage(null);
        setPendingImageBase64(dataUrl.split(",")[1] ?? dataUrl);
        event.target.value = "";
    }

    if (isUserLoading) {
        return <div className="auth-page"><div className="auth-title">Загрузка...</div></div>;
    }

    if (!canOpenPage) {
        return <Navigate to="/profile" replace />;
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
                    <div className="airline-profile-header">
                        <div className="airline-profile-image-box">
                            {(pendingImageBase64 ?? imageBase64) ? (
                                <img
                                    src={`data:image/png;base64,${pendingImageBase64 ?? imageBase64}`}
                                    alt="Авиакомпания"
                                    className="airline-profile-image"
                                />
                            ) : (
                                <div className="airline-profile-image-placeholder">
                                    AirCharter
                                </div>
                            )}
                        </div>

                        <div className="airline-profile-heading">
                            <div className="airline-profile-image-actions">
                                <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isSaving}
                                >
                                    Сменить фото
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    className="airline-profile-file-input"
                                    onChange={handleImageChange}
                                />
                            </div>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="form-message">Загрузка...</div>
                    ) : (
                        <form onSubmit={handleSubmit} className="airline-profile-form">
                            <section className="airline-profile-section">
                                <h2>Основное</h2>
                                <div className="airline-profile-grid">
                                    <InputField label="Название" value={formData.airlineName} onChange={(value) => updateField("airlineName", value)} required />
                                    <InputField label="Полное наименование" value={formData.organizationFullName} onChange={(value) => updateField("organizationFullName", value)} required />
                                    <InputField label="Краткое наименование" value={formData.organizationShortName} onChange={(value) => updateField("organizationShortName", value)} required />
                                    <InputField label="Email" type="email" value={formData.email} onChange={(value) => updateField("email", value)} required />
                                    <InputField label="Телефон" value={formData.phoneNumber} onChange={(value) => updateField("phoneNumber", value)} required />
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
                                    <InputField label="Срок действия договора, дней" type="number" min="1" value={formData.contractValidityDays?.toString() ?? ""} onChange={(value) => updateField("contractValidityDays", value)} required />
                                    <InputField label="Срок оплаты, дней" type="number" min="1" value={formData.paymentDeadlineDays?.toString() ?? ""} onChange={(value) => updateField("paymentDeadlineDays", value)} required />
                                    <InputField label="Прибытие пассажиров до вылета, минут" type="number" min="1" value={formData.passengerArrivalMinutesBeforeFlight?.toString() ?? ""} onChange={(value) => updateField("passengerArrivalMinutesBeforeFlight", value)} required />
                                    <InputField label="Класс бортпитания" value={formData.cateringClass ?? ""} onChange={(value) => updateField("cateringClass", value)} required />
                                </div>
                            </section>

                            {statusMessage && (
                                <div className={`form-message ${statusMessage.type}`}>
                                    {statusMessage.text}
                                </div>
                            )}

                            <div className="airline-profile-actions">
                                <button
                                    type="submit"
                                    className="auth-submit-button"
                                    disabled={!isChanged || isSaving}
                                >
                                    {isSaving ? "Сохранение..." : "Сохранить"}
                                </button>
                            </div>
                        </form>
                    )}
                </main>
            </div>
        </div>
    );
}

function createFormData(settings: AirlineContractSettingsResponse): UpdateAirlineContractSettingsRequest {
    return {
        airlineName: settings.airlineName ?? "",
        organizationFullName: settings.organizationFullName ?? "",
        organizationShortName: settings.organizationShortName ?? "",
        legalAddress: settings.legalAddress ?? "",
        postalAddress: settings.postalAddress ?? "",
        phoneNumber: settings.phoneNumber ?? "",
        email: settings.email ?? "",
        bankName: settings.bankName ?? "",
        taxpayerId: settings.taxpayerId ?? "",
        taxRegistrationReasonCode: settings.taxRegistrationReasonCode ?? "",
        primaryStateRegistrationNumber: settings.primaryStateRegistrationNumber ?? "",
        currentAccountNumber: settings.currentAccountNumber ?? "",
        correspondentAccountNumber: settings.correspondentAccountNumber ?? "",
        bankIdentifierCode: settings.bankIdentifierCode ?? "",
        contractCity: settings.contractCity ?? "",
        contractValidityDays: settings.contractValidityDays ?? null,
        paymentDeadlineDays: settings.paymentDeadlineDays ?? null,
        cateringClass: settings.cateringClass ?? "",
        passengerArrivalMinutesBeforeFlight: settings.passengerArrivalMinutesBeforeFlight ?? null
    };
}

function sanitizeFormData(formData: UpdateAirlineContractSettingsRequest): UpdateAirlineContractSettingsRequest {
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

function isNumericField(name: keyof UpdateAirlineContractSettingsRequest): boolean {
    return name === "contractValidityDays" ||
        name === "paymentDeadlineDays" ||
        name === "passengerArrivalMinutesBeforeFlight";
}

function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
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
