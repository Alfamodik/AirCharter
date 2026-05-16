import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/header/Header";
import {
    acceptAirlineEmploymentInvitation,
    getMyNotifications,
    markMyNotificationAsRead,
    markMyNotificationsAsRead,
    type NotificationResponse
} from "../../api/notificationService";
import { useUser } from "../../context/UserContext";
import "./NotificationsPage.css";

type NotificationStatusMessage = {
    text: string;
    type: "load" | "action";
};

export default function NotificationsPage() {
    const navigate = useNavigate();
    const { refreshUser } = useUser();
    const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [statusMessage, setStatusMessage] = useState<NotificationStatusMessage | null>(null);

    const unreadCount = useMemo(
        () => notifications.filter((notification) => !notification.readAtUtc).length,
        [notifications]
    );

    useEffect(() => {
        const abortController = new AbortController();

        async function loadNotifications() {
            try {
                const response = await getMyNotifications(abortController.signal);
                setNotifications(response);
                setStatusMessage(null);
            } catch {
                if (!abortController.signal.aborted) {
                    setStatusMessage({
                        text: "Не удалось загрузить уведомления.",
                        type: "load"
                    });
                }
            } finally {
                if (!abortController.signal.aborted) {
                    setIsLoading(false);
                }
            }
        }

        void loadNotifications();

        return () => abortController.abort();
    }, []);

    async function handleMarkAsRead(notificationId: number) {
        if (isSaving) {
            return;
        }

        setIsSaving(true);
        setStatusMessage(null);

        try {
            await markMyNotificationAsRead(notificationId);
            setNotifications((currentNotifications) =>
                currentNotifications.map((notification) =>
                    notification.id === notificationId
                        ? { ...notification, readAtUtc: new Date().toISOString() }
                        : notification));
        } catch {
            setStatusMessage({
                text: "Не удалось обновить уведомление.",
                type: "action"
            });
        } finally {
            setIsSaving(false);
        }
    }

    async function handleMarkAllAsRead() {
        if (isSaving || unreadCount === 0) {
            return;
        }

        setIsSaving(true);
        setStatusMessage(null);

        try {
            await markMyNotificationsAsRead();
            const readAtUtc = new Date().toISOString();
            setNotifications((currentNotifications) =>
                currentNotifications.map((notification) => ({
                    ...notification,
                    readAtUtc: notification.readAtUtc ?? readAtUtc
                })));
        } catch {
            setStatusMessage({
                text: "Не удалось обновить уведомления.",
                type: "action"
            });
        } finally {
            setIsSaving(false);
        }
    }

    async function handleAcceptInvitation(notificationId: number) {
        if (isSaving) {
            return;
        }

        setIsSaving(true);
        setStatusMessage(null);

        try {
            const response = await acceptAirlineEmploymentInvitation(notificationId);
            localStorage.setItem("accessToken", response.token);
            await refreshUser();
            const readAtUtc = new Date().toISOString();
            setNotifications((currentNotifications) =>
                currentNotifications.map((notification) =>
                    notification.id === notificationId
                        ? { ...notification, readAtUtc }
                        : notification));
        } catch (error: unknown) {
            setStatusMessage({
                text: getApiErrorMessage(error, "Не удалось принять приглашение."),
                type: "action"
            });
        } finally {
            setIsSaving(false);
        }
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

            <main className="notifications-page">
                <div className="notifications-header">
                    <h1>Уведомления</h1>
                    <button
                        type="button"
                        className="secondary-button"
                        onClick={handleMarkAllAsRead}
                        disabled={isSaving || unreadCount === 0}
                    >
                        Прочитать все
                    </button>
                </div>

                {isLoading ? (
                    <div className="catalog-message">Загрузка...</div>
                ) : statusMessage?.type === "load" && notifications.length === 0 ? (
                    <div className="form-message error">{statusMessage.text}</div>
                ) : notifications.length === 0 ? (
                    <div className="catalog-message">Уведомлений пока нет</div>
                ) : (
                    <>
                        {statusMessage?.type === "action" && (
                            <div className="form-message error">{statusMessage.text}</div>
                        )}
                        <div className="notifications-list">
                            {notifications.map((notification) => (
                                <article
                                    key={notification.id}
                                    className={`notification-item ${notification.readAtUtc ? "read" : "unread"}`}
                                >
                                    <div className="notification-content">
                                        <div className="notification-title-row">
                                            <h2>{notification.title}</h2>
                                            {!notification.readAtUtc && <span>Новое</span>}
                                        </div>
                                        <p>{notification.message}</p>
                                        <time>{formatDateTime(notification.createdAtUtc)}</time>
                                    </div>
                                    {(notification.actionType === "AirlineEmploymentInvite" || !notification.readAtUtc) && (
                                        <div className="notification-actions">
                                            {notification.actionType === "AirlineEmploymentInvite" && (
                                                <button
                                                    type="button"
                                                    className="auth-submit-button"
                                                    onClick={() => handleAcceptInvitation(notification.id)}
                                                    disabled={isSaving}
                                                >
                                                    Принять
                                                </button>
                                            )}
                                            {!notification.readAtUtc && (
                                                <button
                                                    type="button"
                                                    className="secondary-button"
                                                    onClick={() => handleMarkAsRead(notification.id)}
                                                    disabled={isSaving}
                                                >
                                                    Прочитать
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </article>
                            ))}
                        </div>
                    </>
                )}
            </main>
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

function getApiErrorMessage(error: unknown, fallback: string): string {
    if (typeof error === "object" && error !== null && "message" in error) {
        const message = error.message;

        if (typeof message === "string" && message.trim() !== "") {
            return message.trim();
        }
    }

    return fallback;
}
