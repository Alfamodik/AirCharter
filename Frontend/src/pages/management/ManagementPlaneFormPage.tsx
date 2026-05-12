import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import Header from "../../components/header/Header";
import {
    createMyPlane,
    getMyPlane,
    updateMyPlane
} from "../../api/planesService";
import { hasManagementAccess } from "../../api/utils/roleAccess";
import { useUser } from "../../context/UserContext";
import { validateImageAspectRatio } from "../../utils/imageAspectRatio";
import type {
    ManagementPlaneResponse,
    SavePlaneRequest
} from "../../contracts/responses/planes/managementPlaneResponse";
import {
    formatNumber,
    formatPrice,
    getSafeDistance,
    rangeSafetyFactor
} from "./ManagementPlanesPage";
import { isInRange, planeSpecificationLimits } from "./planeSpecificationLimits";
import "./ManagementPage.css";
import "./ManagementPlanesPage.css";

type PlaneFormState = {
    modelName: string;
    maxDistance: string;
    passengerCapacity: string;
    cruisingSpeed: string;
    flightHourCost: string;
    imageBase64: string | null;
};

const emptyPlaneForm: PlaneFormState = {
    modelName: "",
    maxDistance: "",
    passengerCapacity: "",
    cruisingSpeed: "",
    flightHourCost: "",
    imageBase64: null
};

export default function ManagementPlaneFormPage() {
    const navigate = useNavigate();
    const { planeId } = useParams();
    const { user, isLoading: isUserLoading } = useUser();
    const parsedPlaneId = planeId === undefined ? null : Number(planeId);
    const isCreateMode = parsedPlaneId === null;
    const [formState, setFormState] = useState<PlaneFormState>(emptyPlaneForm);
    const [isLoading, setIsLoading] = useState(!isCreateMode);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        if (
            isCreateMode ||
            isUserLoading ||
            user === null ||
            !hasManagementAccess(user.role?.name) ||
            parsedPlaneId === null ||
            Number.isNaN(parsedPlaneId)
        ) {
            return;
        }

        const abortController = new AbortController();

        async function loadPlane() {
            setIsLoading(true);
            setErrorMessage("");

            try {
                const plane = await getMyPlane(parsedPlaneId!, abortController.signal);
                setFormState(createFormState(plane));
            } catch {
                if (!abortController.signal.aborted) {
                    setErrorMessage("Не удалось загрузить самолет.");
                }
            } finally {
                if (!abortController.signal.aborted) {
                    setIsLoading(false);
                }
            }
        }

        loadPlane();

        return () => abortController.abort();
    }, [isCreateMode, isUserLoading, parsedPlaneId, user]);

    const safeDistance = useMemo(() => {
        const maxDistance = Number(formState.maxDistance);

        if (!Number.isFinite(maxDistance) || maxDistance <= 0) {
            return "";
        }

        return `${formatNumber(getSafeDistance(maxDistance))} км`;
    }, [formState.maxDistance]);

    if (!isUserLoading && (user === null || !hasManagementAccess(user.role?.name))) {
        return <Navigate to="/catalog" replace />;
    }

    if (parsedPlaneId !== null && Number.isNaN(parsedPlaneId)) {
        return <Navigate to="/management/planes" replace />;
    }

    function updateField(fieldName: keyof PlaneFormState, value: string | null) {
        setFormState((currentState) => ({
            ...currentState,
            [fieldName]: value
        }));
    }

    async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        if (!file.type.startsWith("image/")) {
            setErrorMessage("Выберите файл изображения.");
            return;
        }

        let hasValidAspectRatio = false;

        try {
            hasValidAspectRatio = await validateImageAspectRatio(file, { width: 16, height: 9 });
        } catch {
            setErrorMessage("Выберите файл изображения.");
            event.target.value = "";
            return;
        }

        if (!hasValidAspectRatio) {
            setErrorMessage("Изображение самолёта должно быть в формате 16:9.");
            event.target.value = "";
            return;
        }

        const imageBase64 = await readFileAsDataUrl(file);
        updateField("imageBase64", imageBase64);
        setErrorMessage("");
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const request = buildSaveRequest(formState);

        if (typeof request === "string") {
            setErrorMessage(request);
            return;
        }

        setIsSaving(true);
        setErrorMessage("");

        try {
            if (isCreateMode) {
                await createMyPlane(request);
            } else {
                await updateMyPlane(parsedPlaneId!, request);
            }

            navigate("/management/planes");
        } catch (error: unknown) {
            setErrorMessage(getApiErrorMessage(error, "Не удалось сохранить самолет. Проверьте поля формы."));
        } finally {
            setIsSaving(false);
        }
    }

    const imageSource = getImageSource(formState.imageBase64);

    return (
        <div className="catalog-wrapper">
            <Header showSearch={false}>
                <button
                    className="header-icon-btn"
                    onClick={() => navigate("/management/planes")}
                    title="Назад"
                >
                    <svg viewBox="0 0 24 24">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                </button>
            </Header>

            <div className="management-plane-form-layout-full">
                <main className="catalog-main management-plane-form-page">
                    {isLoading ? (
                        <div className="management-empty-state">Загрузка самолета...</div>
                    ) : (
                        <form className="management-card management-plane-editor" onSubmit={handleSubmit}>
                            <div className="management-flight-image management-plane-editor-image">
                                {imageSource ? (
                                    <img src={imageSource} alt={formState.modelName || "Самолет"} />
                                ) : (
                                    <div className="management-flight-image-placeholder"></div>
                                )}

                                <div className="management-flight-hero-overlay">
                                    <div className="management-flight-hero-title">
                                        <span className="management-card-label">
                                            {isCreateMode ? "Новый самолет" : "Редактирование самолета"}
                                        </span>
                                        <h1>{formState.modelName || "Модель самолета"}</h1>
                                    </div>
                                </div>
                            </div>

                            <div className="management-plane-editor-body">
                                <div className="management-plane-form-grid">
                                    <FormField
                                        label="Модель"
                                        value={formState.modelName}
                                        onChange={(value) => updateField("modelName", value)}
                                    />
                                    <FormField
                                        label="Пассажировместимость"
                                        value={formState.passengerCapacity}
                                        onChange={(value) => updateField("passengerCapacity", value)}
                                        type="number"
                                        min={planeSpecificationLimits.passengerCapacity.min}
                                        max={planeSpecificationLimits.passengerCapacity.max}
                                    />
                                    <FormField
                                        label="Крейсерская скорость, км/ч"
                                        value={formState.cruisingSpeed}
                                        onChange={(value) => updateField("cruisingSpeed", value)}
                                        type="number"
                                        min={planeSpecificationLimits.cruisingSpeed.min}
                                        max={planeSpecificationLimits.cruisingSpeed.max}
                                    />
                                    <FormField
                                        label="Стоимость часа, ₽"
                                        value={formState.flightHourCost}
                                        onChange={(value) => updateField("flightHourCost", value)}
                                        type="number"
                                        min={planeSpecificationLimits.flightHourCost.min}
                                        max={planeSpecificationLimits.flightHourCost.max}
                                    />
                                    <FormField
                                        label="Дальность, км"
                                        value={formState.maxDistance}
                                        onChange={(value) => updateField("maxDistance", value)}
                                        type="number"
                                        min={planeSpecificationLimits.maxDistance.min}
                                        max={planeSpecificationLimits.maxDistance.max}
                                    />
                                    <FormField
                                        label="Безопасная дальность"
                                        value={safeDistance}
                                        onChange={() => undefined}
                                        note={`Используется коэффициент ${rangeSafetyFactor}; маршрутный участок уменьшается до 85% от максимальной дальности.`}
                                        readOnly
                                    />
                                </div>

                                {errorMessage !== "" && (
                                    <div className="management-inline-error">{errorMessage}</div>
                                )}

                                <div className="management-plane-form-actions">
                                    <button
                                        type="button"
                                        className="management-secondary-button"
                                        onClick={() => navigate("/management/planes")}
                                        disabled={isSaving}
                                    >
                                        Отмена
                                    </button>

                                    <label className="management-secondary-button management-plane-image-button">
                                        Выбрать изображение
                                        <input type="file" accept="image/*" onChange={handleImageChange} />
                                    </label>

                                    <button
                                        type="submit"
                                        className="management-primary-button"
                                        disabled={isSaving}
                                    >
                                        {isSaving ? "Сохранение..." : "Сохранить"}
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}
                </main>
            </div>
        </div>
    );
}

function FormField({
    label,
    value,
    onChange,
    placeholder,
    type = "text",
    readOnly = false,
    note,
    min,
    max
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: string;
    readOnly?: boolean;
    note?: string;
    min?: number;
    max?: number;
}) {
    return (
        <label className="management-plane-form-field">
            <span>{label}</span>
            <input
                type={type}
                min={type === "number" ? min ?? 1 : undefined}
                max={type === "number" ? max : undefined}
                value={value}
                placeholder={placeholder}
                readOnly={readOnly}
                onChange={(event) => onChange(event.target.value)}
            />
            {note && <small>{note}</small>}
        </label>
    );
}

function createFormState(plane: ManagementPlaneResponse): PlaneFormState {
    return {
        modelName: plane.modelName,
        maxDistance: plane.maxDistance.toString(),
        passengerCapacity: plane.passengerCapacity.toString(),
        cruisingSpeed: plane.cruisingSpeed.toString(),
        flightHourCost: plane.flightHourCost.toString(),
        imageBase64: plane.imageBase64 ?? null
    };
}

function buildSaveRequest(formState: PlaneFormState): SavePlaneRequest | string {
    const modelName = formState.modelName.trim();
    const maxDistance = Number(formState.maxDistance);
    const passengerCapacity = Number(formState.passengerCapacity);
    const cruisingSpeed = Number(formState.cruisingSpeed);
    const flightHourCost = Number(formState.flightHourCost);

    if (modelName === "") {
        return "Укажите модель самолета.";
    }

    if ([maxDistance, passengerCapacity, cruisingSpeed, flightHourCost].some((value) => !Number.isFinite(value) || value <= 0)) {
        return "Числовые характеристики должны быть больше 0.";
    }

    if (!Number.isInteger(maxDistance)) {
        return "Дальность должна быть целым числом.";
    }

    if (!isInRange(maxDistance, planeSpecificationLimits.maxDistance.min, planeSpecificationLimits.maxDistance.max)) {
        return `Дальность должна быть от ${formatNumber(planeSpecificationLimits.maxDistance.min)} до ${formatNumber(planeSpecificationLimits.maxDistance.max)} км.`;
    }

    if (!Number.isInteger(passengerCapacity)) {
        return "Пассажировместимость должна быть целым числом.";
    }

    if (!isInRange(passengerCapacity, planeSpecificationLimits.passengerCapacity.min, planeSpecificationLimits.passengerCapacity.max)) {
        return `Пассажировместимость должна быть от ${planeSpecificationLimits.passengerCapacity.min} до ${planeSpecificationLimits.passengerCapacity.max}.`;
    }

    if (!Number.isInteger(cruisingSpeed)) {
        return "Крейсерская скорость должна быть целым числом.";
    }

    if (!isInRange(cruisingSpeed, planeSpecificationLimits.cruisingSpeed.min, planeSpecificationLimits.cruisingSpeed.max)) {
        return `Крейсерская скорость должна быть от ${formatNumber(planeSpecificationLimits.cruisingSpeed.min)} до ${formatNumber(planeSpecificationLimits.cruisingSpeed.max)} км/ч.`;
    }

    if (!isInRange(flightHourCost, planeSpecificationLimits.flightHourCost.min, planeSpecificationLimits.flightHourCost.max)) {
        return `Стоимость часа должна быть от ${formatPrice(planeSpecificationLimits.flightHourCost.min)} до ${formatPrice(planeSpecificationLimits.flightHourCost.max)}.`;
    }

    return {
        modelName,
        maxDistance,
        passengerCapacity,
        cruisingSpeed,
        flightHourCost,
        imageBase64: formState.imageBase64
    };
}

function getImageSource(imageBase64: string | null): string | null {
    if (!imageBase64) {
        return null;
    }

    return imageBase64.startsWith("data:")
        ? imageBase64
        : `data:image/jpeg;base64,${imageBase64}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result as string);
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
