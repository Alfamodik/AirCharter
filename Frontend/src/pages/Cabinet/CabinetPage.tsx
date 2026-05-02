import { useState, useEffect } from "react";
import Header from "../../components/header/Header";
import UserDepartureCard from "../../components/userDepartureCard/UserDepartureCard";
import { useUser } from "../../context/UserContext";
import { getUserDepartures } from "../../api/userService";
import type { MyDepartureResponse } from "../../contracts/responses/users/myDepartureResponse";
import "./CabinetPage.css";
import { useNavigate } from "react-router-dom";

export default function CabinetPage() {
    const navigate = useNavigate();
    const { user, isLoading: isUserLoading } = useUser();
    const [orders, setOrders] = useState<MyDepartureResponse[]>([]);
    const [isOrdersLoading, setIsOrdersLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const data = await getUserDepartures();
                setOrders(data);
            } catch (error) {
                console.error("Failed to fetch departures:", error);
            } finally {
                setIsOrdersLoading(false);
            }
        };

        fetchOrders();
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
