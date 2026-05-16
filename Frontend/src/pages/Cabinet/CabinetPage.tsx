import { useState, useEffect } from "react";
import Header from "../../components/header/Header";
import UserDepartureCard from "../../components/userDepartureCard/UserDepartureCard";
import { useUser } from "../../context/UserContext";
import { getUserDepartures } from "../../api/userService";
import { getMyNotifications } from "../../api/notificationService";
import type { MyDepartureResponse } from "../../contracts/responses/users/myDepartureResponse";
import "./CabinetPage.css";
import { useNavigate } from "react-router-dom";
import { hasAirlineProfileAccess } from "../../api/utils/roleAccess";

const completedStatusIds = new Set<number>([14, 17, 18]);

export default function CabinetPage() {
    const navigate = useNavigate();
    const { user, isLoading: isUserLoading } = useUser();
    const [orders, setOrders] = useState<MyDepartureResponse[]>([]);
    const [isOrdersLoading, setIsOrdersLoading] = useState<boolean>(true);
    const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

    useEffect(() => {
        let isMounted = true;

        const fetchOrders = async () => {
            try {
                const data = await getUserDepartures();
                if (isMounted) {
                    setOrders(sortDepartures(data));
                }
            } catch (error) {
                console.error("Failed to fetch departures:", error);
            } finally {
                if (isMounted) {
                    setIsOrdersLoading(false);
                }
            }
        };

        const fetchNotifications = async () => {
            try {
                const data = await getMyNotifications();
                if (isMounted) {
                    setUnreadNotificationCount(data.filter((notification) => !notification.readAtUtc).length);
                }
            } catch {
                if (isMounted) {
                    setUnreadNotificationCount(0);
                }
            }
        };

        void fetchOrders();
        void fetchNotifications();

        return () => {
            isMounted = false;
        };
    }, []);

    const showLoading = isUserLoading || isOrdersLoading;

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
                        <a href="/profile" className="profile-redirect-btn">
                            Профиль
                        </a>
                        <button
                            type="button"
                            className="profile-redirect-btn"
                            onClick={() => navigate("/notifications")}
                        >
                            <span>Уведомления</span>
                            {unreadNotificationCount > 0 && (
                                <span className="cabinet-notification-badge">{unreadNotificationCount}</span>
                            )}
                        </button>
                        {!isUserLoading && user?.airlineId && hasAirlineProfileAccess(user.role?.name) && (
                            <button
                                type="button"
                                className="profile-redirect-btn"
                                onClick={() => navigate("/airline-profile")}
                            >
                                Профиль авиакомпании
                            </button>
                        )}
                        {!isUserLoading && !user?.airlineId && (
                            <button
                                type="button"
                                className="profile-redirect-btn cabinet-airline-register-btn"
                                onClick={() => navigate("/airline-register")}
                            >
                                Зарегистрировать авиакомпанию
                            </button>
                        )}
                    </div>
                </aside>

                <main className="catalog-main">
                    <div className="orders-list">
                        {showLoading ? (
                            <div className="catalog-message">Загрузка данных...</div>
                        ) : orders.length > 0 ? (
                            orders.map((order) => (
                                <UserDepartureCard 
                                    key={order.id} 
                                    departure={order} 
                                    onClick={() => navigate(`/cabinet/departures/${order.id}`)}
                                />
                            ))
                        ) : (
                            <div className="catalog-message">У вас пока нет активных заказов</div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}

function sortDepartures(departures: MyDepartureResponse[]): MyDepartureResponse[] {
    return [...departures].sort((firstDeparture, secondDeparture) => {
        const firstIsCompleted = isCompletedDeparture(firstDeparture);
        const secondIsCompleted = isCompletedDeparture(secondDeparture);
        const firstDate = getDepartureSortTime(firstDeparture);
        const secondDate = getDepartureSortTime(secondDeparture);

        if (firstIsCompleted !== secondIsCompleted) {
            return firstIsCompleted ? 1 : -1;
        }

        if (firstIsCompleted) {
            return secondDate - firstDate;
        }

        return firstDate - secondDate;
    });
}

function isCompletedDeparture(departure: MyDepartureResponse): boolean {
    return departure.currentStatusId !== undefined &&
        departure.currentStatusId !== null &&
        completedStatusIds.has(departure.currentStatusId);
}

function getDepartureSortTime(departure: MyDepartureResponse): number {
    const date = new Date(departure.takeOffDateTime);

    return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
}
