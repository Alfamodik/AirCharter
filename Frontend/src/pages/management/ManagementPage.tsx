import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Header from "../../components/header/Header";
import { useUser } from "../../context/UserContext";
import { getManagementDepartures } from "../../api/managementService";
import type { ManagementDepartureResponse } from "../../contracts/responses/departures/managementDepartureResponse";
import { hasManagementAccess } from "../../api/utils/roleAccess";
import "./ManagementPage.css";

export default function ManagementPage() {
    const navigate = useNavigate();
    const { user, isLoading: isUserLoading } = useUser();

    const [departures, setDepartures] = useState<ManagementDepartureResponse[]>([]);
    const [isDeparturesLoading, setIsDeparturesLoading] = useState<boolean>(true);
    const [errorMessage, setErrorMessage] = useState<string>("");

    useEffect(() => {
        if (isUserLoading) {
            return;
        }

        if (user === null || !hasManagementAccess(user.role?.name)) {
            setIsDeparturesLoading(false);
            return;
        }

        const fetchDepartures = async () => {
            setIsDeparturesLoading(true);
            setErrorMessage("");

            try {
                const response = await getManagementDepartures();
                setDepartures(response);
            } catch (error) {
                console.error("Failed to fetch management departures:", error);
                setErrorMessage("Не удалось загрузить список вылетов.");
            } finally {
                setIsDeparturesLoading(false);
            }
        };

        fetchDepartures();
    }, [isUserLoading, user]);

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
                </aside>

                <main className="catalog-main">
                    <div className="orders-list">
                        {showLoading ? (
                            <div className="catalog-message">Загрузка данных...</div>
                        ) : errorMessage !== "" ? (
                            <div className="catalog-message">{errorMessage}</div>
                        ) : departures.length > 0 ? (
                            departures.map((departure) => (
                                <div key={departure.id} className="order-row">
                                    <div className="order-main-info">
                                        <span className="order-model">
                                            {departure.planeModelName}
                                        </span>

                                        <span className="order-dest">
                                            {buildAirportLabel(
                                                departure.takeOffAirportCity,
                                                departure.takeOffAirportName,
                                                departure.takeOffAirportIata,
                                                departure.takeOffAirportIcao
                                            )}
                                            {" → "}
                                            {buildAirportLabel(
                                                departure.landingAirportCity,
                                                departure.landingAirportName,
                                                departure.landingAirportIata,
                                                departure.landingAirportIcao
                                            )}
                                        </span>
                                    </div>

                                    <div className="order-date-block">
                                        <span className="order-date-label">Вылет</span>
                                        <span className="order-date-value">
                                            {formatDateTime(departure.requestedTakeOffDateTime)}
                                        </span>
                                    </div>

                                    <div className="order-status-block">
                                        <span className={`status-badge ${getStatusClassName(departure.statusName)}`}>
                                            {departure.statusName}
                                        </span>

                                        <span className="order-requester-email">
                                            {departure.charterRequesterEmail}
                                        </span>
                                    </div>

                                    <div className="order-info-price">
                                        {formatPrice(departure.price)}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="catalog-message">
                                Вылеты вашей авиакомпании пока отсутствуют
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}

function buildAirportLabel(
    airportCity?: string | null,
    airportName?: string | null,
    airportIata?: string | null,
    airportIcao?: string | null
): string {
    const airportCode = airportIata || airportIcao;

    if (airportCity && airportCode) {
        return `${airportCity} (${airportCode})`;
    }

    if (airportCity) {
        return airportCity;
    }

    if (airportName && airportCode) {
        return `${airportName} (${airportCode})`;
    }

    if (airportName) {
        return airportName;
    }

    return "Неизвестный аэропорт";
}

function formatDateTime(value: string): string {
    return new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date(value));
}

function formatPrice(value: number): string {
    return new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: "RUB",
        maximumFractionDigits: 2
    }).format(value);
}

function getStatusClassName(statusName: string): string {
    const normalizedStatusName = statusName.trim().toLowerCase();

    if (
        normalizedStatusName.includes("одоб") ||
        normalizedStatusName.includes("подтверж") ||
        normalizedStatusName.includes("confirmed") ||
        normalizedStatusName.includes("approved")
    ) {
        return "confirmed";
    }

    if (
        normalizedStatusName.includes("отклон") ||
        normalizedStatusName.includes("cancel") ||
        normalizedStatusName.includes("rejected")
    ) {
        return "rejected";
    }

    return "pending";
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
