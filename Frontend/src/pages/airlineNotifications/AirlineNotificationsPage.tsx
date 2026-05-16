import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
    getMyAirlineNotifications,
    type AirlineNotificationResponse
} from "../../api/airlineService";
import { hasManagementAccess } from "../../api/utils/roleAccess";
import Header from "../../components/header/Header";
import { useUser } from "../../context/UserContext";
import { ManagementSidebar } from "../management/ManagementPlanesPage";
import "../notifications/NotificationsPage.css";

export default function AirlineNotificationsPage() {
    const navigate = useNavigate();
    const { user, isLoading: isUserLoading } = useUser();
    const [notifications, setNotifications] = useState<AirlineNotificationResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    const canOpenPage = !isUserLoading && Boolean(user?.airlineId) && hasManagementAccess(user?.role?.name);

    useEffect(() => {
        if (!canOpenPage) {
            return;
        }

        const abortController = new AbortController();

        async function loadNotifications() {
            try {
                const response = await getMyAirlineNotifications(abortController.signal);
                setNotifications(response);
                setStatusMessage(null);
            } catch {
                if (!abortController.signal.aborted) {
                    setStatusMessage("Не удалось загрузить уведомления авиакомпании.");
                }
            } finally {
                if (!abortController.signal.aborted) {
                    setIsLoading(false);
                }
            }
        }

        void loadNotifications();

        return () => abortController.abort();
    }, [canOpenPage]);

    if (isUserLoading) {
        return <div className="auth-page"><div className="auth-title">Загрузка...</div></div>;
    }

    if (!canOpenPage) {
        return <Navigate to="/catalog" replace />;
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

            <div className="catalog-layout">
                <ManagementSidebar
                    email={user?.email}
                    roleName={user?.role?.name}
                    isUserLoading={isUserLoading}
                />

                <main className="catalog-main notifications-page">
                    {isLoading ? (
                        <div className="catalog-message">Загрузка...</div>
                    ) : statusMessage ? (
                        <div className="form-message error">{statusMessage}</div>
                    ) : notifications.length === 0 ? (
                        <div className="catalog-message">Уведомлений пока нет</div>
                    ) : (
                        <div className="notifications-list">
                            {notifications.map((notification) => (
                                <article
                                    key={notification.id}
                                    className="notification-item"
                                >
                                    <div className="notification-content">
                                        <div className="notification-title-row">
                                            <h2>{notification.title}</h2>
                                        </div>
                                        <p>{notification.message}</p>
                                        <time>{formatDateTime(notification.createdAtUtc)}</time>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

function formatDateTime(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString("ru-RU");
}
