import type { UserDepartureResponse } from "../../contracts/responses/users/userDepartureResponse";
import "./UserDepartureCard.css";

interface UserDepartureCardProps {
    departure: UserDepartureResponse;
}

export default function UserDepartureCard({ departure }: UserDepartureCardProps) {
    // Маппинг русских статусов на латинские классы
    const getStatusClass = (status: string): string => {
        const s = status.toLowerCase();
        if (s.includes("ожидает") || s.includes("ожидание")) return "status-pending";
        if (s.includes("создании") || s.includes("планируется")) return "status-draft";
        if (s.includes("пути") || s.includes("посадка") || s.includes("открыт")) return "status-active";
        if (s.includes("завершен") || s.includes("приземлился")) return "status-completed";
        if (s.includes("отменен") || s.includes("отклонен")) return "status-cancelled";
        if (s.includes("задержан")) return "status-delayed";
        return "status-default";
    };

    const statusClass = getStatusClass(departure.status);

    return (
        <div className="departure-card">
            <div className="departure-image-section">
                <img 
                    src={departure.planeImage ? `data:image/png;base64,${departure.planeImage}` : "/placeholder-plane.png"} 
                    className="departure-plane-hero" 
                    alt={departure.modelName} 
                />
                {departure.airlineImage && (
                    <div className="departure-airline-badge">
                        <img src={`data:image/png;base64,${departure.airlineImage}`} alt="Airline" />
                    </div>
                )}
            </div>

            <div className="departure-content-section">
                <div className="departure-header">
                    <div className="departure-route">
                        <div className="airport-block">
                            <span className="airport-code">{departure.takeOffAirport}</span>
                            <span className="airport-label">Вылет</span>
                        </div>
                        <div className="route-path">
                            <div className="path-line"></div>
                            <svg className="plane-icon" viewBox="0 0 24 24">
                                <path d="M21,16L21,14L13,9L13,3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5L10,9L2,14L2,16L10,13.5L10,18L8,19.5L8,21L11.5,20L15,21L15,19.5L13,18L13,13.5L21,16Z" />
                            </svg>
                        </div>
                        <div className="airport-block">
                            <span className="airport-code">{departure.landingAirport}</span>
                            <span className="airport-label">Прибытие</span>
                        </div>
                    </div>
                    
                    <div className="departure-status-block">
                        <span className={`status-badge ${statusClass}`}>
                            {departure.status}
                        </span>
                        <span className="model-name-text">{departure.modelName}</span>
                    </div>
                </div>

                <div className="departure-details-grid">
                    <div className="info-item">
                        <span className="info-label">Дата вылета</span>
                        <span className="info-value">
                            {new Date(departure.takeOffDateTime).toLocaleString('ru-RU', { 
                                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                            })}
                        </span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">В пути</span>
                        <span className="info-value">{departure.flightTime}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">Дистанция</span>
                        <span className="info-value">{departure.distance} км</span>
                    </div>
                    <div className="info-item price-item">
                        <span className="info-label">Стоимость</span>
                        <span className="info-value price-text">{departure.price.toLocaleString()} ₽</span>
                    </div>
                </div>
            </div>
        </div>
    );
}