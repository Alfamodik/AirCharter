import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import InputField from "../../components/InputField/InputField";
import AirportSearch, { type AirportSelection } from "../../components/AirportSearch/AirportSearch";
import { createOrder, getFlightCost } from "../../api/orderService";
import "./OrderPage.css";

type OrderNavigationState = {
    imageBase64?: string;
    flightCost?: number;
};

const catalogPagePath = "/";

function getTodayLocalDateString(): string {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const day = String(currentDate.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

export default function OrderPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParameters, setSearchParameters] = useSearchParams();

    const navigationState = (location.state as OrderNavigationState | null) ?? null;

    const planeId = Number(searchParameters.get("planeId") || "0");
    const modelName = searchParameters.get("modelName") || "Выбранный самолёт";

    const [planeImageBase64] = useState<string | undefined>(navigationState?.imageBase64);

    const [orderFormData, setOrderFormData] = useState({
        takeOffAirportId: searchParameters.get("from") || "",
        takeOffAirportDisplayName: searchParameters.get("fromLabel") || "",
        landingAirportId: searchParameters.get("to") || "",
        landingAirportDisplayName: searchParameters.get("toLabel") || "",
        departureDate: "",
        departureTime: "12:00"
    });

    const [currentFlightCost, setCurrentFlightCost] = useState<number>(navigationState?.flightCost ?? 0);
    const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const minimumDate = getTodayLocalDateString();
    const heroImageUrl = planeImageBase64
        ? `data:image/jpeg;base64,${planeImageBase64}`
        : "/assets/images/noname_plane.png";

    useEffect(() => {
        if (!planeId) {
            return;
        }

        if (!orderFormData.takeOffAirportId || !orderFormData.landingAirportId) {
            return;
        }

        updateFlightPrice();
    }, [planeId, orderFormData.takeOffAirportId, orderFormData.landingAirportId]);

    function updateSearchParameters(updates: Record<string, string>) {
        const updatedSearchParameters = new URLSearchParams(searchParameters);

        Object.entries(updates).forEach(([name, value]) => {
            if (value.trim() === "") {
                updatedSearchParameters.delete(name);
                return;
            }

            updatedSearchParameters.set(name, value);
        });

        setSearchParameters(updatedSearchParameters);
    }

    async function updateFlightPrice() {
        try {
            const priceResponse = await getFlightCost({
                planeId,
                takeOffAirportId: Number(orderFormData.takeOffAirportId),
                landingAirportId: Number(orderFormData.landingAirportId)
            });

            setCurrentFlightCost(priceResponse.cost);
        } catch {
            setCurrentFlightCost(0);
        }
    }

    function handleTakeOffAirportSelect(airport: AirportSelection) {
        setOrderFormData((previousValue) => ({
            ...previousValue,
            takeOffAirportId: airport.id,
            takeOffAirportDisplayName: airport.displayName
        }));

        updateSearchParameters({
            from: airport.id,
            fromLabel: airport.displayName
        });
    }

    function handleLandingAirportSelect(airport: AirportSelection) {
        setOrderFormData((previousValue) => ({
            ...previousValue,
            landingAirportId: airport.id,
            landingAirportDisplayName: airport.displayName
        }));

        updateSearchParameters({
            to: airport.id,
            toLabel: airport.displayName
        });
    }

    async function handleSubmitOrder(event: React.FormEvent) {
        event.preventDefault();

        if (!planeId || !orderFormData.takeOffAirportId || !orderFormData.landingAirportId || !orderFormData.departureDate) {
            setStatusMessage({ text: "Заполните все поля", type: "error" });
            return;
        }

        setIsSubmitting(true);
        setStatusMessage(null);

        try {
            const requestedTakeOffDateTime =
                `${orderFormData.departureDate}T${orderFormData.departureTime}:00`;

            await createOrder({
                planeId,
                takeOffAirportId: Number(orderFormData.takeOffAirportId),
                landingAirportId: Number(orderFormData.landingAirportId),
                requestedTakeOffDateTime
            });

            setStatusMessage({ text: "Заявка успешно создана!", type: "success" });

            window.setTimeout(() => {
                navigate("/cabinet");
            }, 1500);
        } catch {
            setStatusMessage({ text: "Ошибка при создании заявки", type: "error" });
        } finally {
            setIsSubmitting(false);
        }
    }

    if (!planeId) {
        return (
            <div className="catalog-wrapper">
                <div className="catalog-message error">Самолёт не выбран</div>
                <button onClick={() => navigate(catalogPagePath)}>Вернуться в каталог</button>
            </div>
        );
    }

    return (
        <div className="catalog-wrapper">
            <div className="profile-scroll-container">
                <div className="profile-content-card order-page-card">
                    <div className="order-plane-hero" style={{ backgroundImage: `url(${heroImageUrl})` }}>
                        <button
                            className="order-back-button"
                            onClick={() => navigate(catalogPagePath)}
                            type="button"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20">
                                <line x1="19" y1="12" x2="5" y2="12"></line>
                                <polyline points="12 19 5 12 12 5"></polyline>
                            </svg>
                        </button>

                        <div className="order-plane-info-overlay">
                            <h1 className="model-value-large">{modelName}</h1>
                        </div>
                    </div>

                    <form onSubmit={handleSubmitOrder} className="auth-form">
                        <div className="filters-stack">
                            <AirportSearch
                                label="Откуда"
                                selectedAirportId={orderFormData.takeOffAirportId}
                                selectedAirportDisplayName={orderFormData.takeOffAirportDisplayName}
                                onSelect={handleTakeOffAirportSelect}
                            />

                            <AirportSearch
                                label="Куда"
                                selectedAirportId={orderFormData.landingAirportId}
                                selectedAirportDisplayName={orderFormData.landingAirportDisplayName}
                                onSelect={handleLandingAirportSelect}
                            />

                            <div className="passport-row">
                                <InputField
                                    label="Дата вылета"
                                    type="date"
                                    min={minimumDate}
                                    value={orderFormData.departureDate}
                                    onChange={(value) =>
                                        setOrderFormData((previousValue) => ({
                                            ...previousValue,
                                            departureDate: value
                                        }))
                                    }
                                    required
                                />

                                <InputField
                                    label="Время"
                                    type="time"
                                    value={orderFormData.departureTime}
                                    onChange={(value) =>
                                        setOrderFormData((previousValue) => ({
                                            ...previousValue,
                                            departureTime: value
                                        }))
                                    }
                                    required
                                />
                            </div>
                        </div>

                        <div className="order-summary-section">
                            <div className="summary-item">
                                <span className="summary-label">Итоговая стоимость:</span>
                                <span className="price-highlight">
                                    {currentFlightCost.toLocaleString("ru-RU")} ₽
                                </span>
                            </div>
                        </div>

                        {statusMessage && (
                            <div className={`form-message ${statusMessage.type}`}>
                                {statusMessage.text}
                            </div>
                        )}

                        <button type="submit" className="auth-submit-button" disabled={isSubmitting}>
                            {isSubmitting ? "Создание..." : "Подтвердить заказ"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}