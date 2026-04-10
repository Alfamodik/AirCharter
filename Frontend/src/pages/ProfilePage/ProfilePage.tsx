import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getMyPerson, updateMyPerson } from "../../api/personService";
import type { ProfileFormData } from "../../contracts/responses/persons/profileFormData";
import InputField from "../../components/InputField/InputField";
import "./ProfilePage.css";

export default function ProfilePage() {
    const navigate = useNavigate();
    const today = new Date().toISOString().split('T')[0];

    const [initialData, setInitialData] = useState<ProfileFormData | null>(null);
    const [formData, setFormData] = useState<ProfileFormData>({
        firstName: "",
        lastName: "",
        patronymic: "",
        passportSeries: "",
        passportNumber: "",
        email: "",
        birthDate: ""
    });
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

    useEffect(() => {
        loadPersonData();
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
                birthDate: person.birthDate ? person.birthDate.toString().split('T')[0] : ""
            };
            setFormData(data);
            setInitialData(data);
        } catch {
            setStatusMessage({ text: "Ошибка загрузки профиля", type: "error" });
        } finally {
            setIsLoading(false);
        }
    }

    const isChanged = JSON.stringify(initialData) !== JSON.stringify(formData);

    const updateField = (name: keyof ProfileFormData, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const validateAge = (birthDate: string): boolean => {
        if (!birthDate) return true;
        const birth = new Date(birthDate);
        const now = new Date();
        let age = now.getFullYear() - birth.getFullYear();
        const monthDiff = now.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
            age--;
        }
        return age >= 12;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!isChanged || isSaving) return;

        // Защита от ввода даты из будущего вручную
        if (formData.birthDate && new Date(formData.birthDate) > new Date()) {
            setStatusMessage({ text: "Дата рождения не может быть в будущем", type: "error" });
            return;
        }

        setIsSaving(true);
        setStatusMessage(null);

        const sanitizedData: ProfileFormData = {
            ...formData,
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            patronymic: formData.patronymic?.trim() || null,
            email: formData.email?.trim() || null,
            birthDate: formData.birthDate || null
        };

        try {
            await updateMyPerson(sanitizedData);
            setInitialData({ ...formData });
            
            if (!validateAge(formData.birthDate || "")) {
                setStatusMessage({ 
                    text: "Изменения сохранены. Напоминаем: пассажиры младше 12 лет летают только с сопровождающим.", 
                    type: "success" 
                });
            } else {
                setStatusMessage({ text: "Изменения сохранены", type: "success" });
            }
        } catch {
            setStatusMessage({ text: "Не удалось сохранить данные. Проверьте поля.", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="auth-page"><div className="auth-title">Загрузка...</div></div>;

    return (
        <div className="auth-page">
            <button className="auth-back-button" onClick={() => navigate("/cabinet")}>
                ← Назад
            </button>

            <div className="auth-card profile-card-width">
                <h1 className="auth-title">Профиль</h1>

                <form onSubmit={handleSubmit} className="auth-form">
                    <InputField 
                        label="Фамилия" 
                        value={formData.lastName} 
                        onChange={(val) => updateField("lastName", val)} 
                        required 
                    />
                    <InputField 
                        label="Имя" 
                        value={formData.firstName} 
                        onChange={(val) => updateField("firstName", val)} 
                        required 
                    />
                    <InputField 
                        label="Отчество" 
                        value={formData.patronymic ?? ""} 
                        onChange={(val) => updateField("patronymic", val)} 
                    />
                    
                    <div className="passport-row">
                        <InputField 
                            label="Серия" 
                            value={formData.passportSeries} 
                            onChange={(val) => updateField("passportSeries", val.replace(/\D/g, ''))} 
                            maxLength={4} 
                            required 
                        />
                        <InputField 
                            label="Номер" 
                            value={formData.passportNumber} 
                            onChange={(val) => updateField("passportNumber", val.replace(/\D/g, ''))} 
                            maxLength={6} 
                            required 
                        />
                    </div>

                    <InputField 
                        label="Дата рождения" 
                        type="date" 
                        value={formData.birthDate ?? ""} 
                        max={today}
                        onChange={(val) => updateField("birthDate", val)} 
                    />
                    
                    <InputField 
                        label="Email для связи" 
                        type="email" 
                        value={formData.email ?? ""} 
                        onChange={(val) => updateField("email", val)} 
                    />

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
    );
}