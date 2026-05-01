import "./CatalogPlaneCard.css";
import flightRouteIcon from "../../assets/icons/flight-route-white.png";

type Airport = {
    id: number;
    name: string;
    city: string;
    country: string;
    iata: string | null;
    icao: string;
    latitude: number;
    longitude: number;
};

type RouteLeg = {
    fromAirportId: number;
    toAirportId: number;
    distanceKm: number;
    flightTime: string;
    flightCost: number;
    groundTimeAfterArrival: string | null;
};

type CatalogPlaneCardProps = {
    modelName: string;
    passengerCapacity: number;
    maxDistance: number;
    flightCost?: number;
    flightTime: string;
    numberOfTransfers: string;
    imageBase64?: string;
    routeAirports?: Airport[];
    routeLegs?: RouteLeg[];
    onOrderClick: () => void;
    onRouteClick?: () => void;
};

export default function CatalogPlaneCard({
    modelName,
    passengerCapacity,
    maxDistance,
    flightCost,
    flightTime,
    numberOfTransfers,
    imageBase64,
    routeAirports,
    onOrderClick,
    onRouteClick
}: CatalogPlaneCardProps) {
    const hasRoute = routeAirports !== undefined && routeAirports.length > 0;

    return (
        <article className="plane-card">
            <div className="plane-card-image-box">
                {imageBase64 ? (
                    <img
                        src={`data:image/jpeg;base64,${imageBase64}`}
                        alt={modelName}
                        className="plane-img"
                    />
                ) : (
                    <div className="plane-img-placeholder">✈️</div>
                )}

                {flightTime && <div className="plane-card-badge">{flightTime}</div>}
            </div>

            <div className="plane-card-content">
                <h3 className="plane-model-title">{modelName}</h3>

                <div className="plane-specs-list">
                    <div className="spec-item">
                        <span className="spec-label">Мест:</span>
                        <span className="spec-value">{passengerCapacity}</span>
                    </div>

                    <div className="spec-item">
                        <span className="spec-label">Дальность:</span>
                        <span className="spec-value">{maxDistance} км</span>
                    </div>

                    <div className="spec-item">
                        <span className="spec-label">Пересадки:</span>
                        <span className="spec-value">{numberOfTransfers || "0"}</span>
                    </div>
                </div>

                <div className="plane-card-footer">
                    <div className="plane-price">
                        {flightCost !== undefined
                            ? `${Math.floor(flightCost).toLocaleString("ru-RU")}₽`
                            : ""}
                    </div>

                    <div className="footer-actions-right">
                        {hasRoute && (
                            <button
                                type="button"
                                className="route-icon-btn"
                                onClick={onRouteClick}
                                title="Показать маршрут"
                            >
                                <img
                                    src={flightRouteIcon}
                                    alt="Маршрут"
                                    className="route-icon-img"
                                />
                            </button>
                        )}

                        <button type="button" className="book-btn" onClick={onOrderClick}>
                            Заказать
                        </button>
                    </div>
                </div>
            </div>
        </article>
    );
}
