import React from "react";
import "./CatalogPlaneCard.css";

type CatalogPlaneCardProps = {
    modelName: string;
    passengerCapacity: number;
    maxDistance: number;
    flightCost?: number;
    flightTime: string;
    numberOfTransfers: string;
    imageBase64?: string;
    onOrderClick: () => void;
};

export default function CatalogPlaneCard({
    modelName,
    passengerCapacity,
    maxDistance,
    flightCost,
    flightTime,
    numberOfTransfers,
    imageBase64,
    onOrderClick
}: CatalogPlaneCardProps) {
    return (
        <article className="plane-card">
            <div className="plane-card-image-box">
                {imageBase64 ? (
                    <img src={`data:image/jpeg;base64,${imageBase64}`} alt={modelName} className="plane-img" />
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
                        {flightCost !== undefined ? `${Math.floor(flightCost).toLocaleString("ru-RU")} ₽` : ""}
                    </div>
                    <button className="book-btn" onClick={onOrderClick}>
                        Заказать
                    </button>
                </div>
            </div>
        </article>
    );
}