import { useState } from "react";
import Header from "../../components/Header/Header";
import { useUser } from "../../context/UserContext";
import "./CabinetPage.css";

interface Order {
    id: number;
    modelName: string;
    departureTime: string;
    arrivalAirport: string;
    status: string;
    price: number;
}

export default function CabinetPage() {
    const { user, isLoading } = useUser();
    const [orders] = useState<Order[]>([]);

    return (
        <div className="catalog-wrapper">
            <Header showSearch={false}>
                <button 
                    className="toggle-sidebar-btn back-navbar-btn" 
                    onClick={() => window.history.back()}
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
                            {isLoading ? "Загрузка..." : user?.email}
                        </span>
                        <a href="/profile" className="profile-redirect-btn">Профиль пользователя</a>
                    </div>
                </aside>

                <main className="catalog-main">
                    <div className="orders-list">
                        {orders.length > 0 ? (
                            orders.map((order) => (
                                <div key={order.id} className="order-row">
                                    <div className="order-info-main">
                                        <span className="order-model">{order.modelName}</span>
                                        <span className="order-dest">Направление: {order.arrivalAirport}</span>
                                    </div>
                                    <div className="order-info-date">
                                        <span>{new Date(order.departureTime).toLocaleString()}</span>
                                    </div>
                                    <div className="order-info-status">
                                        <span className={`status-badge ${order.status.toLowerCase()}`}>
                                            {order.status}
                                        </span>
                                    </div>
                                    <div className="order-info-price">
                                        {order.price.toLocaleString()} ₽
                                    </div>
                                </div>
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