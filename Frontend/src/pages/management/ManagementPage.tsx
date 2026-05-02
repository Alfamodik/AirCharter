import { useCallback, useEffect, useState } from "react";
import { NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import Header from "../../components/header/Header";
import {
    approveManagementDeparture,
    getManagementDepartures,
    rejectManagementDeparture,
    type ManagementSection
} from "../../api/managementService";
import { useUser } from "../../context/UserContext";
import { hasManagementAccess } from "../../api/utils/roleAccess";
import type {
    ManagementDepartureResponse,
    ManagementRouteAirportResponse,
    ManagementRouteLegResponse
} from "../../contracts/responses/departures/managementDepartureResponse";
import "./ManagementPage.css";

const managementNavigationItems: Array<{
    section: ManagementSection;
    label: string;
    path: string;
}> = [
    {
        section: "orders",
        label: "Заявки",
        path: "/management/orders"
    },
    {
        section: "flights",
        label: "Текущие вылеты",
        path: "/management/flights"
    },
    {
        section: "completed",
        label: "Завершённые вылеты",
        path: "/management/completed"
    }
];

export default function ManagementPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, isLoading: isUserLoading } = useUser();

    const currentSection = getCurrentSection(location.pathname);
    const [departures, setDepartures] = useState<ManagementDepartureResponse[]>([]);
    const [expandedDepartureId, setExpandedDepartureId] = useState<number | null>(null);
    const [isDeparturesLoading, setIsDeparturesLoading] = useState(true);
    const [actionDepartureId, setActionDepartureId] = useState<number | null>(null);
    const [errorMessage, setErrorMessage] = useState("");

    const loadDepartures = useCallback(async (signal?: AbortSignal) => {
        setIsDeparturesLoading(true);
        setErrorMessage("");
        setExpandedDepartureId(null);

        try {
            const response = await getManagementDepartures(currentSection, signal);
            setDepartures(response);
        } catch {
            if (!signal?.aborted) {
                setErrorMessage("Не удалось загрузить вылеты.");
            }
        } finally {
            if (!signal?.aborted) {
                setIsDeparturesLoading(false);
            }
        }
    }, [currentSection]);

    useEffect(() => {
        if (isUserLoading || user === null || !hasManagementAccess(user.role?.name)) {
            return;
        }

        const abortController = new AbortController();
        loadDepartures(abortController.signal);

        return () => abortController.abort();
    }, [isUserLoading, loadDepartures, user]);

    async function handleApprove(departureId: number) {
        setActionDepartureId(departureId);
        setErrorMessage("");

        try {
            await approveManagementDeparture(departureId);
            await loadDepartures();
        } catch {
            setErrorMessage("Не удалось одобрить заявку.");
        } finally {
            setActionDepartureId(null);
        }
    }

    async function handleReject(departureId: number) {
        setActionDepartureId(departureId);
        setErrorMessage("");

        try {
            await rejectManagementDeparture(departureId);
            await loadDepartures();
        } catch {
            setErrorMessage("Не удалось отклонить заявку.");
        } finally {
            setActionDepartureId(null);
        }
    }

    if (!isUserLoading && (user === null || !hasManagementAccess(user.role?.name))) {
        return <Navigate to="/catalog" replace />;
    }

    const showLoading = isUserLoading || isDeparturesLoading;

    return (
        <div className="catalog-wrapper">
            <Header showSearch={false}>
                <button
                    className="header-icon-btn"
                    onClick={() => navigate("/catalog")}
                    title="Назад"
                >
                    <svg viewBox="0 0 24 24">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                </button>
            </Header>

            <div className="catalog-layout">
                <aside className="catalog-sidebar">
                    <div className="user-brief-info">
                        <span className="user-email-label">
                            {isUserLoading ? "Загрузка..." : user?.email}
                        </span>

                        <span className="user-role-label">
                            {isUserLoading ? "" : getRoleText(user?.role?.name)}
                        </span>
                    </div>

                    <nav className="management-nav" aria-label="Разделы управления">
                        {managementNavigationItems.map((item) => (
                            <NavLink
                                key={item.section}
                                to={item.path}
                                className={({ isActive }) =>
                                    isActive || currentSection === item.section
                                        ? "management-nav-link active"
                                        : "management-nav-link"
                                }
                            >
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>
                </aside>

                <main className="catalog-main">
                    {showLoading ? (
                        <div className="management-empty-state">Загрузка данных...</div>
                    ) : errorMessage !== "" && departures.length === 0 ? (
                        <div className="management-empty-state">{errorMessage}</div>
                    ) : departures.length === 0 ? (
                        <div className="management-empty-state">
                            {getEmptyStateText(currentSection)}
                        </div>
                    ) : (
                        <>
                            {errorMessage !== "" && (
                                <div className="management-inline-error">{errorMessage}</div>
                            )}

                            <div className="management-card-list">
                                {departures.map((departure) => (
                                    <ManagementDepartureCard
                                        key={departure.id}
                                        departure={departure}
                                        section={currentSection}
                                        isExpanded={expandedDepartureId === departure.id}
                                        isActionLoading={actionDepartureId === departure.id}
                                        onToggle={() =>
                                            setExpandedDepartureId((currentValue) =>
                                                currentValue === departure.id ? null : departure.id
                                            )
                                        }
                                        onEditRoute={() => navigate(`/management/orders/${departure.id}`)}
                                        onApprove={() => handleApprove(departure.id)}
                                        onReject={() => handleReject(departure.id)}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}

function ManagementDepartureCard({
    departure,
    section,
    isExpanded,
    isActionLoading,
    onToggle,
    onEditRoute,
    onApprove,
    onReject
}: {
    departure: ManagementDepartureResponse;
    section: ManagementSection;
    isExpanded: boolean;
    isActionLoading: boolean;
    onToggle: () => void;
    onEditRoute: () => void;
    onApprove: () => void;
    onReject: () => void;
}) {
    const routeTitle = `${buildAirportLabel(
        departure.takeOffAirportCity,
        departure.takeOffAirportName,
        departure.takeOffAirportIata,
        departure.takeOffAirportIcao
    )} → ${buildAirportLabel(
        departure.landingAirportCity,
        departure.landingAirportName,
        departure.landingAirportIata,
        departure.landingAirportIcao
    )}`;

    return (
        <article className={`management-card ${isExpanded ? "expanded" : ""}`}>
            <button type="button" className="management-card-summary" onClick={onToggle}>
                <span className={`management-card-chevron ${isExpanded ? "expanded" : ""}`}>
                    ▾
                </span>

                <span className="management-card-main">
                    <span className="management-card-title">{departure.planeModelName}</span>
                    <span className="management-card-route">{routeTitle}</span>
                    <span className="management-card-client">
                        {departure.charterRequesterEmail}
                    </span>
                </span>

                <span className="management-card-date">
                    <span className="management-card-label">Вылет</span>
                    <span>{formatDateTime(departure.requestedTakeOffDateTime)}</span>
                </span>

                <span className="management-card-status">
                    <span className={`status-badge ${getStatusClassName(departure.currentStatusId)}`}>
                        {departure.statusName}
                    </span>
                    <span className="management-card-label">
                        с {formatDateTime(departure.currentStatusSetAt)}
                    </span>
                </span>

                <span className="management-card-price">{formatPrice(departure.price)}</span>
            </button>

            {isExpanded && (
                <div className="management-card-details">
                    <ManagementDepartureDetails departure={departure} />

                    {section === "orders" && (
                        <div className="management-card-actions">
                            <button
                                type="button"
                                className="management-danger-button"
                                onClick={onReject}
                                disabled={isActionLoading || !departure.canApprove}
                            >
                                Отклонить
                            </button>

                            <button
                                type="button"
                                className="management-secondary-button"
                                onClick={onEditRoute}
                                disabled={isActionLoading || !departure.canEditRoute}
                            >
                                Редактировать маршрут
                            </button>

                            <button
                                type="button"
                                className="management-primary-button"
                                onClick={onApprove}
                                disabled={isActionLoading || !departure.canApprove}
                            >
                                Одобрить
                            </button>
                        </div>
                    )}
                </div>
            )}
        </article>
    );
}

export function ManagementDepartureDetails({
    departure
}: {
    departure: ManagementDepartureResponse;
}) {
    return (
        <>
            <div className="management-detail-grid">
                <InfoBlock label="Создано" value={formatOptionalDateTime(departure.createdAt)} />
                <InfoBlock label="Прибытие" value={formatDateTime(departure.arrivalDateTime)} />
                <InfoBlock label="Расстояние" value={`${formatNumber(departure.distance)} км`} />
                <InfoBlock label="Время в пути" value={formatDuration(departure.flightTime)} />
                <InfoBlock label="Пересадки" value={departure.transfers.toString()} />
                <InfoBlock
                    label="Пассажиры"
                    value={`${departure.passengerCount} из ${departure.planePassengerCapacity}`}
                />
            </div>

            <section className="management-detail-section">
                <h3>Маршрут</h3>
                {departure.routeLegs.length === 0 ? (
                    <p className="management-muted-text">Детали маршрута недоступны.</p>
                ) : (
                    <div className="management-route-leg-list">
                        {departure.routeLegs.map((leg, index) => (
                            <RouteLegRow
                                key={`${leg.fromAirportId}-${leg.toAirportId}-${index}`}
                                leg={leg}
                                airports={departure.routeAirports}
                            />
                        ))}
                    </div>
                )}
            </section>

            <section className="management-detail-section">
                <h3>Пассажиры</h3>
                {departure.passengers.length === 0 ? (
                    <p className="management-muted-text">Пассажиры не указаны.</p>
                ) : (
                    <div className="management-passenger-list">
                        {departure.passengers.map((passenger) => (
                            <div key={passenger.id} className="management-passenger-row">
                                <span>{passenger.fullName}</span>
                                <span>{passenger.email || "Почта не указана"}</span>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="management-detail-section">
                <h3>История статусов</h3>
                <div className="management-status-history">
                    {departure.statusHistory.map((status) => (
                        <div key={`${status.id}-${status.setAt}`} className="management-status-row">
                            <span>{status.name}</span>
                            <span>{formatDateTime(status.setAt)}</span>
                        </div>
                    ))}
                </div>
            </section>
        </>
    );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
    return (
        <div className="management-info-block">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function RouteLegRow({
    leg,
    airports
}: {
    leg: ManagementRouteLegResponse;
    airports: ManagementRouteAirportResponse[];
}) {
    const fromAirport = airports.find((airport) => airport.id === leg.fromAirportId);
    const toAirport = airports.find((airport) => airport.id === leg.toAirportId);

    const routeTitle = `${fromAirport ? getAirportDisplayName(fromAirport) : leg.fromAirportId} → ${
        toAirport ? getAirportDisplayName(toAirport) : leg.toAirportId
    }`;

    return (
        <div className="management-route-leg-row">
            <strong>{routeTitle}</strong>
            <span>
                {formatNumber(leg.distanceKm)} км • {formatDuration(leg.flightTime)} • {formatPrice(leg.flightCost)}
            </span>
            {leg.groundTimeAfterArrival && (
                <span>Стоянка в аэропорту: {formatDuration(leg.groundTimeAfterArrival)}</span>
            )}
        </div>
    );
}

function getCurrentSection(pathname: string): ManagementSection {
    if (pathname.includes("/management/flights")) {
        return "flights";
    }

    if (pathname.includes("/management/completed")) {
        return "completed";
    }

    return "orders";
}

function getEmptyStateText(section: ManagementSection): string {
    switch (section) {
        case "orders":
            return "Заявок нет";

        case "flights":
            return "Текущих вылетов нет";

        case "completed":
            return "Завершённых вылетов нет";
    }
}

export function buildAirportLabel(
    airportCity?: string | null,
    airportName?: string | null,
    airportIata?: string | null,
    airportIcao?: string | null
): string {
    const airportCode = airportIata || airportIcao;
    const airportTitle = airportCity || airportName || "Неизвестный аэропорт";

    if (!airportCode) {
        return airportTitle;
    }

    return `${airportTitle} (${airportCode})`;
}

export function getAirportDisplayName(airport: ManagementRouteAirportResponse): string {
    return buildAirportLabel(airport.city, airport.name, airport.iata, airport.icao);
}

export function formatDateTime(value: string): string {
    return new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date(value));
}

export function formatOptionalDateTime(value?: string | null): string {
    if (!value) {
        return "Не указано";
    }

    return formatDateTime(value);
}

export function formatDuration(value: string): string {
    const timeRegex = /(?:(\d+)\.)?(\d+):(\d+)(?::(\d+))?/;
    const match = value.match(timeRegex);

    if (!match) {
        return value;
    }

    const days = match[1] ? Number(match[1]) : 0;
    const hours = Number(match[2]) + days * 24;
    const minutes = Number(match[3]);

    if (hours <= 0) {
        return `${minutes} мин`;
    }

    if (minutes <= 0) {
        return `${hours} ч`;
    }

    return `${hours} ч ${minutes} мин`;
}

export function formatPrice(value: number): string {
    return new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: "RUB",
        maximumFractionDigits: 0
    }).format(value);
}

export function formatNumber(value: number): string {
    return value.toLocaleString("ru-RU");
}

function getStatusClassName(statusId: number): string {
    if (statusId === 17 || statusId === 18) {
        return "rejected";
    }

    if (statusId === 2) {
        return "pending";
    }

    if (statusId === 14) {
        return "confirmed";
    }

    return "active";
}

function getRoleText(roleName?: string | null): string {
    switch (roleName) {
        case "Owner":
            return "Владелец";

        case "Manager":
            return "Менеджер";

        case "Admin":
            return "Администратор";

        case "GeneralDirector":
            return "Генеральный директор";

        case "Employee":
            return "Сотрудник";

        default:
            return "";
    }
}
