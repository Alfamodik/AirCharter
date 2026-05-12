import { useCallback, useEffect, useState, type ReactNode } from "react";
import { NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import Header from "../../components/header/Header";
import {
    approveManagementDeparture,
    confirmManagementDepartureContractDocument,
    getManagementDepartures,
    rejectManagementDeparture,
    type ManagementSection
} from "../../api/managementService";
import { downloadDepartureContractDocument } from "../../api/userService";
import { useUser } from "../../context/UserContext";
import { hasAirlineProfileAccess, hasManagementAccess } from "../../api/utils/roleAccess";
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
        const departure = departures.find((currentDeparture) => currentDeparture.id === departureId);

        if (departure === undefined || isDateTimeTodayOrEarlier(departure.requestedTakeOffDateTime)) {
            return;
        }

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

    async function handleDownloadContractDocument(departure: ManagementDepartureResponse) {
        setActionDepartureId(departure.id);
        setErrorMessage("");

        try {
            const contractBlob = await downloadDepartureContractDocument(departure.id);
            downloadBlob(
                contractBlob,
                departure.contractDocumentFileName || `Подписанный договор ${departure.id}.pdf`
            );
        } catch {
            setErrorMessage("Не удалось скачать подписанный договор.");
        } finally {
            setActionDepartureId(null);
        }
    }

    async function handleConfirmContractDocument(departureId: number) {
        setActionDepartureId(departureId);
        setErrorMessage("");

        try {
            await confirmManagementDepartureContractDocument(departureId);
            await loadDepartures();
        } catch {
            setErrorMessage("Не удалось подтвердить подписанный договор.");
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

                        {!isUserLoading && hasAirlineProfileAccess(user?.role?.name) && (
                            <NavLink to="/airline-profile" className="profile-redirect-btn">
                                Профиль авиакомпании
                            </NavLink>
                        )}

                        <NavLink to="/management/planes" className="profile-redirect-btn">
                            Самолеты
                        </NavLink>
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
                                        onEditRoute={() => navigate(getDepartureDetailsPath(currentSection, departure.id), {
                                            state: { backTo: location.pathname }
                                        })}
                                        onManageFlight={() => navigate(`/management/flights/${departure.id}`, {
                                            state: { backTo: location.pathname }
                                        })}
                                        onApprove={() => handleApprove(departure.id)}
                                        onReject={() => handleReject(departure.id)}
                                        onDownloadContractDocument={() => handleDownloadContractDocument(departure)}
                                        onConfirmContractDocument={() => handleConfirmContractDocument(departure.id)}
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
    onManageFlight,
    onApprove,
    onReject,
    onDownloadContractDocument,
    onConfirmContractDocument
}: {
    departure: ManagementDepartureResponse;
    section: ManagementSection;
    isExpanded: boolean;
    isActionLoading: boolean;
    onToggle: () => void;
    onEditRoute: () => void;
    onManageFlight: () => void;
    onApprove: () => void;
    onReject: () => void;
    onDownloadContractDocument: () => void;
    onConfirmContractDocument: () => void;
}) {
    const isTakeOffDateTimeTooEarly = section === "orders" &&
        isDateTimeTodayOrEarlier(departure.requestedTakeOffDateTime);
    const canApproveDeparture = departure.canApprove && !isTakeOffDateTimeTooEarly;
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
                    <span className={isTakeOffDateTimeTooEarly ? "management-date-warning" : undefined}>
                        {formatDateTime(departure.requestedTakeOffDateTime)}
                    </span>
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
                                disabled={isActionLoading}
                            >
                                Открыть заявку
                            </button>

                            {departure.hasContractDocument && (
                                <button
                                    type="button"
                                    className="management-secondary-button"
                                    onClick={onDownloadContractDocument}
                                    disabled={isActionLoading}
                                >
                                    Скачать договор
                                </button>
                            )}

                            {departure.currentStatusId === 19 && departure.hasContractDocument ? (
                                <button
                                    type="button"
                                    className="management-primary-button"
                                    onClick={onConfirmContractDocument}
                                    disabled={isActionLoading}
                                >
                                    Подтвердить договор
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="management-primary-button"
                                    onClick={onApprove}
                                    disabled={isActionLoading || !canApproveDeparture}
                                >
                                    Одобрить
                                </button>
                            )}
                        </div>
                    )}

                    {section === "flights" && (
                        <div className="management-card-actions">
                            <button
                                type="button"
                                className="management-primary-button"
                                onClick={onManageFlight}
                                disabled={isActionLoading}
                            >
                                Управление вылетом
                            </button>
                        </div>
                    )}

                    {section === "completed" && (
                        <div className="management-card-actions">
                            <button
                                type="button"
                                className="management-secondary-button"
                                onClick={onEditRoute}
                                disabled={isActionLoading}
                            >
                                Открыть заявку
                            </button>
                        </div>
                    )}
                </div>
            )}
        </article>
    );
}

function getDepartureDetailsPath(section: ManagementSection, departureId: number): string {
    switch (section) {
        case "flights":
            return `/management/flights/${departureId}`;
        case "completed":
            return `/management/completed/${departureId}`;
        case "orders":
        default:
            return `/management/orders/${departureId}`;
    }
}

function downloadBlob(blob: Blob, fileName: string) {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
}

export function ManagementDepartureDetails({
    departure
}: {
    departure: ManagementDepartureResponse;
}) {
    const [expandedDetailSections, setExpandedDetailSections] = useState<Set<string>>(() => new Set());

    function toggleDetailSection(sectionKey: string) {
        setExpandedDetailSections((currentSections) => {
            const nextSections = new Set(currentSections);

            if (nextSections.has(sectionKey)) {
                nextSections.delete(sectionKey);
            } else {
                nextSections.add(sectionKey);
            }

            return nextSections;
        });
    }

    function renderDetailSection(
        sectionKey: string,
        title: string,
        content: ReactNode,
        sideContent?: ReactNode
    ) {
        const isSectionExpanded = expandedDetailSections.has(sectionKey);

        return (
            <section className={`management-card management-detail-section-card ${isSectionExpanded ? "expanded" : ""}`}>
                <button
                    type="button"
                    className="management-card-summary management-section-toggle"
                    onClick={() => toggleDetailSection(sectionKey)}
                    aria-expanded={isSectionExpanded}
                >
                    <span className={`management-card-chevron ${isSectionExpanded ? "expanded" : ""}`}></span>
                    <span>{title}</span>
                    {sideContent && (
                        <span className="management-section-toggle-side">{sideContent}</span>
                    )}
                </button>

                {isSectionExpanded && (
                    <div className="management-card-details">
                        {content}
                    </div>
                )}
            </section>
        );
    }

    return (
        <>
            <div className="management-detail-grid">
                <InfoBlock
                    label={departure.currentStatusId === 1 ? "Дата создания заявки" : "Дата подачи заявки"}
                    value={formatOptionalDateTime(departure.submittedAt ?? departure.createdAt)}
                />
                <InfoBlock label="Прибытие" value={formatDateTime(departure.arrivalDateTime)} />
                <InfoBlock label="Расстояние" value={`${formatNumber(departure.distance)} км`} />
                <InfoBlock label="Время в пути" value={formatDuration(departure.flightTime)} />
                <InfoBlock label="Пересадки" value={departure.transfers.toString()} />
                <InfoBlock
                    label="Пассажиры"
                    value={`${departure.passengerCount} из ${departure.planePassengerCapacity}`}
                />
            </div>

            {renderDetailSection(
                "route",
                "Маршрут",
                departure.routeLegs.length === 0 ? (
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
                ),
                <span>{departure.transfers} пересадок</span>
            )}

            {renderDetailSection(
                "passengers",
                "Пассажиры",
                departure.passengers.length === 0 ? (
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
                ),
                <span>{departure.passengerCount} из {departure.planePassengerCapacity}</span>
            )}

            {renderDetailSection(
                "history",
                "История статусов",
                departure.statusHistory.length === 0 ? (
                    <p className="management-muted-text">История статусов недоступна.</p>
                ) : (
                    <div className="management-status-history">
                        {departure.statusHistory.map((status) => (
                            <div key={`${status.id}-${status.setAt}`} className="management-status-row">
                                <span>{status.name}</span>
                                <span>{formatDateTime(status.setAt)}</span>
                            </div>
                        ))}
                    </div>
                )
            )}
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

function isDateTimeTodayOrEarlier(value: string): boolean {
    const date = new Date(value);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    return date < tomorrow;
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

    if (statusId === 2 || statusId === 19 || statusId === 20) {
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
