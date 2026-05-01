import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import InputField from "../../components/inputField/InputField";
import AirportSearch, { type AirportSelection } from "../../components/airportSearch/AirportSearch";
import { createOrder, getFlightCost } from "../../api/orderService";
import type {
    AirportRouteResponse,
    PlaneCatalogResponse,
    RouteLegResponse
} from "../../contracts/requests/orders/createOrderRequest";
import "./OrderPage.css";

type OrderNavigationState = {
    imageBase64?: string;
    flightCalculation?: PlaneCatalogResponse;
};

const catalogPagePath = "/";

function getTodayLocalDateString(): string {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const day = String(currentDate.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatMoney(value: number): string {
    return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

function formatDistance(value: number): string {
    return `${value.toLocaleString("ru-RU")} км`;
}

function formatFlightDuration(value: string): string {
    if (!value) {
        return "0 мин";
    }

    const timeSpanParts = value.split(".");
    const hasDays = timeSpanParts.length === 3 || value.includes(".") && timeSpanParts[0].length <= 2 && timeSpanParts[1].includes(":");

    let days = 0;
    let timeValue = value;

    if (hasDays) {
        days = Number(timeSpanParts[0]);
        timeValue = timeSpanParts.slice(1).join(".");
    }

    const timeWithoutFraction = timeValue.split(".")[0];
    const timeParts = timeWithoutFraction.split(":");

    if (timeParts.length < 2) {
        return "0 мин";
    }

    const hours = Number(timeParts[0]) + days * 24;
    const minutes = Number(timeParts[1]);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        return "0 мин";
    }

    if (hours <= 0) {
        return `${minutes} мин`;
    }

    if (minutes <= 0) {
        return `${hours} ч`;
    }

    return `${hours} ч ${minutes} мин`;
}

function getAirportDisplayName(airport: AirportRouteResponse): string {
    const airportCode = airport.iata || airport.icao || "";
    const city = airport.city || airport.name;

    if (!airportCode) {
        return city;
    }

    return `${city} (${airportCode})`;
}

function getRouteTitle(orderFormData: {
    takeOffAirportDisplayName: string;
    landingAirportDisplayName: string;
}, modelName: string): string {
    if (!orderFormData.takeOffAirportDisplayName || !orderFormData.landingAirportDisplayName) {
        return modelName;
    }

    return `Маршрут: ${orderFormData.takeOffAirportDisplayName} → ${orderFormData.landingAirportDisplayName}`;
}

function findAirportById(
    airports: AirportRouteResponse[],
    airportId: number
): AirportRouteResponse | undefined {
    return airports.find((airport) => airport.id === airportId);
}

export default function OrderPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParameters, setSearchParameters] = useSearchParams();

    const navigationState = (location.state as OrderNavigationState | null) ?? null;

    const planeId = Number(searchParameters.get("planeId") || "0");
    const modelName = searchParameters.get("modelName") || "Выбранный самолёт";

    const [planeImageBase64] = useState<string | undefined>(
        navigationState?.imageBase64 || navigationState?.flightCalculation?.imageBase64 || undefined
    );

    const [orderFormData, setOrderFormData] = useState({
        takeOffAirportId: searchParameters.get("from") || "",
        takeOffAirportDisplayName: searchParameters.get("fromLabel") || "",
        landingAirportId: searchParameters.get("to") || "",
        landingAirportDisplayName: searchParameters.get("toLabel") || "",
        departureDate: "",
        departureTime: "12:00"
    });

    const [flightCalculation, setFlightCalculation] = useState<PlaneCatalogResponse | null>(
        navigationState?.flightCalculation ?? null
    );

    const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCalculatingFlight, setIsCalculatingFlight] = useState(false);

    const minimumDate = getTodayLocalDateString();

    const heroImageUrl = planeImageBase64
        ? `data:image/jpeg;base64,${planeImageBase64}`
        : "/assets/images/noname_plane.png";

    const routeTitle = getRouteTitle(orderFormData, modelName);

    useEffect(() => {
        if (!planeId) {
            return;
        }

        if (!orderFormData.takeOffAirportId || !orderFormData.landingAirportId) {
            setFlightCalculation(null);
            return;
        }

        updateFlightCalculation();
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

        setSearchParameters(updatedSearchParameters, {
            replace: true,
            state: {
                imageBase64: planeImageBase64,
                flightCalculation
            }
        });
    }

    async function updateFlightCalculation() {
        setIsCalculatingFlight(true);

        try {
            const routeCalculation = await getFlightCost({
                planeId,
                takeOffAirportId: Number(orderFormData.takeOffAirportId),
                landingAirportId: Number(orderFormData.landingAirportId)
            });

            if (!routeCalculation.isRouteFound) {
                setFlightCalculation(null);
                setStatusMessage({
                    text: "Для выбранного самолёта маршрут не найден",
                    type: "error"
                });
                return;
            }

            setFlightCalculation(routeCalculation);
            setStatusMessage(null);
        } catch {
            setFlightCalculation(null);
        } finally {
            setIsCalculatingFlight(false);
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

        if (!flightCalculation?.isRouteFound) {
            setStatusMessage({ text: "Сначала дождитесь расчёта маршрута", type: "error" });
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
                            <h1 className="model-value-large">{routeTitle}</h1>
                            <p className="order-plane-model-name">{modelName}</p>
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
                                    {isCalculatingFlight
                                        ? "Расчёт..."
                                        : formatMoney(flightCalculation?.flightCost ?? 0)}
                                </span>
                            </div>

                            {flightCalculation && (
                                <>
                                    <div className="summary-item">
                                        <span className="summary-label">Расстояние:</span>
                                        <span>{formatDistance(flightCalculation.distanceKm)}</span>
                                    </div>

                                    <div className="summary-item">
                                        <span className="summary-label">Время в пути:</span>
                                        <span>{formatFlightDuration(flightCalculation.flightTime)}</span>
                                    </div>

                                    <div className="summary-item">
                                        <span className="summary-label">Пересадки:</span>
                                        <span>{flightCalculation.numberOfTransfers}</span>
                                    </div>

                                    {flightCalculation.routeLegs.length > 0 && (
                                        <div className="route-legs-list">
                                            <div className="summary-label">Детали маршрута</div>

                                            {flightCalculation.routeLegs.map((routeLeg: RouteLegResponse) => {
                                                const fromAirport = findAirportById(
                                                    flightCalculation.routeAirports,
                                                    routeLeg.fromAirportId
                                                );

                                                const toAirport = findAirportById(
                                                    flightCalculation.routeAirports,
                                                    routeLeg.toAirportId
                                                );

                                                return (
                                                    <div
                                                        className="route-leg-item"
                                                        key={`${routeLeg.fromAirportId}-${routeLeg.toAirportId}`}
                                                    >
                                                        <div className="route-leg-title">
                                                            {fromAirport ? getAirportDisplayName(fromAirport) : routeLeg.fromAirportId}
                                                            {" → "}
                                                            {toAirport ? getAirportDisplayName(toAirport) : routeLeg.toAirportId}
                                                        </div>

                                                        <div className="route-leg-description">
                                                            {formatDistance(routeLeg.distanceKm)}
                                                            {" • "}
                                                            {formatFlightDuration(routeLeg.flightTime)}
                                                            {" • "}
                                                            {formatMoney(routeLeg.flightCost)}
                                                        </div>

                                                        {routeLeg.groundTimeAfterArrival && (
                                                            <div className="route-leg-ground-time">
                                                                Стоянка в аэропорту: {formatFlightDuration(routeLeg.groundTimeAfterArrival)}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {statusMessage && (
                            <div className={`form-message ${statusMessage.type}`}>
                                {statusMessage.text}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="auth-submit-button"
                            disabled={isSubmitting || isCalculatingFlight}
                        >
                            {isSubmitting ? "Создание..." : "Подтвердить заказ"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
