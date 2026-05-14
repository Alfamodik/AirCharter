import { useCallback, useEffect, useState } from "react";
import { NavLink, Navigate, useNavigate } from "react-router-dom";
import Header from "../../components/header/Header";
import { getMyPlanes } from "../../api/planesService";
import {
    hasAirlineProfileAccess,
    hasManagementAccess,
    hasOrderManagementAccess,
    hasPlaneManagementAccess
} from "../../api/utils/roleAccess";
import { useUser } from "../../context/UserContext";
import type { ManagementPlaneResponse } from "../../contracts/responses/planes/managementPlaneResponse";
import "./ManagementPage.css";
import "./ManagementPlanesPage.css";

const managementNavigationItems = [
    { label: "Заявки", path: "/management/orders" },
    { label: "Текущие вылеты", path: "/management/flights" },
    { label: "Завершенные вылеты", path: "/management/completed" }
];

export default function ManagementPlanesPage() {
    const navigate = useNavigate();
    const { user, isLoading: isUserLoading } = useUser();
    const [planes, setPlanes] = useState<ManagementPlaneResponse[]>([]);
    const [isPlanesLoading, setIsPlanesLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    const loadPlanes = useCallback(async (signal?: AbortSignal) => {
        setIsPlanesLoading(true);
        setErrorMessage("");

        try {
            const response = await getMyPlanes(signal);
            setPlanes(response);
        } catch {
            if (!signal?.aborted) {
                setErrorMessage("Не удалось загрузить самолеты.");
            }
        } finally {
            if (!signal?.aborted) {
                setIsPlanesLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        if (isUserLoading || user === null || !hasPlaneManagementAccess(user.role?.name)) {
            return;
        }

        const abortController = new AbortController();
        loadPlanes(abortController.signal);

        return () => abortController.abort();
    }, [isUserLoading, loadPlanes, user]);

    if (!isUserLoading && (user === null || !hasPlaneManagementAccess(user.role?.name))) {
        return <Navigate to="/catalog" replace />;
    }

    const showLoading = isUserLoading || isPlanesLoading;

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
                <ManagementSidebar
                    email={user?.email}
                    roleName={user?.role?.name}
                    isUserLoading={isUserLoading}
                />

                <main className="catalog-main management-planes-page">
                    <div className="management-planes-header">
                        <button
                            type="button"
                            className="management-primary-button"
                            onClick={() => navigate("/management/planes/new")}
                        >
                            Добавить самолет
                        </button>
                    </div>

                    {errorMessage !== "" && (
                        <div className="management-inline-error">{errorMessage}</div>
                    )}

                    {showLoading ? (
                        <div className="management-empty-state">Загрузка самолетов...</div>
                    ) : planes.length === 0 ? (
                        <div className="management-empty-state management-planes-empty">
                            <strong>Самолетов пока нет</strong>
                            <span>Добавьте первый борт, чтобы он появился в каталоге.</span>
                        </div>
                    ) : (
                        <div className="management-planes-grid">
                            {planes.map((plane) => (
                                <PlaneCard
                                    key={plane.id}
                                    plane={plane}
                                    onEdit={() => navigate(`/management/planes/${plane.id}`)}
                                />
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

export function ManagementSidebar({
    email,
    roleName,
    isUserLoading
}: {
    email?: string;
    roleName?: string | null;
    isUserLoading: boolean;
}) {
    const canManageOrders = hasOrderManagementAccess(roleName);
    const visibleNavigationItems = managementNavigationItems.filter((item) =>
        item.path !== "/management/orders" || canManageOrders
    );

    return (
        <aside className="catalog-sidebar">
            <div className="user-brief-info">
                <div className="user-brief-header">
                <span className="user-email-label">
                    {isUserLoading ? "Загрузка..." : email}
                </span>

                <span className="user-role-label">
                    {isUserLoading ? "" : getRoleText(roleName)}
                </span>

                </div>

                {!isUserLoading && hasAirlineProfileAccess(roleName) && (
                    <NavLink to="/airline-profile" className="profile-redirect-btn">
                        Профиль авиакомпании
                    </NavLink>
                )}

                {!isUserLoading && hasPlaneManagementAccess(roleName) && (
                <NavLink to="/management/planes" className="profile-redirect-btn">
                    Самолеты
                </NavLink>
                )}

                {!isUserLoading && hasManagementAccess(roleName) && (
                <NavLink to="/management/analytics" className="profile-redirect-btn">
                    Аналитика
                </NavLink>
                )}
            </div>

            <nav className="management-nav" aria-label="Разделы управления">
                {visibleNavigationItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            isActive ? "management-nav-link active" : "management-nav-link"
                        }
                    >
                        {item.label}
                    </NavLink>
                ))}
            </nav>
        </aside>
    );
}

function PlaneCard({
    plane,
    onEdit
}: {
    plane: ManagementPlaneResponse;
    onEdit: () => void;
}) {
    return (
        <article className="management-plane-card">
            <div className="management-plane-image">
                {plane.imageBase64 ? (
                    <img src={`data:image/jpeg;base64,${plane.imageBase64}`} alt={plane.modelName} />
                ) : (
                    <div className="management-plane-image-placeholder">Самолет</div>
                )}
            </div>

            <div className="management-plane-card-body">
                <div className="management-plane-card-title-row">
                    <h2>{plane.modelName}</h2>
                    <button
                        type="button"
                        className="management-secondary-button management-compact-button"
                        onClick={onEdit}
                    >
                        Редактировать
                    </button>
                </div>

                <div className="management-plane-spec-grid">
                    <InfoPill label="Мест" value={plane.passengerCapacity.toString()} />
                    <InfoPill label="Дальность" value={`${formatNumber(plane.maxDistance)} км`} />
                    <InfoPill label="Безопасная дальность" value={`${formatNumber(getSafeDistance(plane.maxDistance))} км`} />
                    <InfoPill label="Скорость" value={`${formatNumber(plane.cruisingSpeed)} км/ч`} />
                    <InfoPill label="Час полета" value={formatPrice(plane.flightHourCost)} />
                </div>
            </div>
        </article>
    );
}

export function InfoPill({ label, value }: { label: string; value: string }) {
    return (
        <div className="management-plane-info-pill">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

export const rangeSafetyFactor = 0.85;

export function getSafeDistance(maxDistance: number): number {
    return Math.max(1, Math.floor(maxDistance * rangeSafetyFactor));
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
