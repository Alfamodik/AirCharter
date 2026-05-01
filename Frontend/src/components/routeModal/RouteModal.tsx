import { useEffect, useMemo, useState } from "react";
import { YMaps, Map, Placemark, Polyline } from "@pbe/react-yandex-maps";
import "./RouteModal.css";

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

type RouteModalProps = {
    onClose: () => void;
    airports: Airport[];
    legs: RouteLeg[];
    modelName: string;
    totalCost?: number;
    totalTime: string;
};

type MapBounds = [[number, number], [number, number]];
type Coordinate = [number, number];

type YandexMapInstance = {
    setBounds: (
        bounds: MapBounds,
        options: {
            checkZoomRange: boolean;
            zoomMargin: [number, number, number, number];
        }
    ) => void;
};

type RoutePolylineItem = {
    key: string;
    geometry: Coordinate[];
    leg: RouteLeg;
    fromAirport: Airport;
    toAirport: Airport;
};

const defaultMapCenter: Coordinate = [55.751244, 37.618423];

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#039;");
}

function toRadians(degrees: number): number {
    return degrees * Math.PI / 180;
}

function toDegrees(radians: number): number {
    return radians * 180 / Math.PI;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function normalizeLongitude(longitude: number, previousLongitude: number | null): number {
    if (previousLongitude === null) {
        return longitude;
    }

    let normalizedLongitude = longitude;

    while (normalizedLongitude - previousLongitude > 180) {
        normalizedLongitude -= 360;
    }

    while (previousLongitude - normalizedLongitude > 180) {
        normalizedLongitude += 360;
    }

    return normalizedLongitude;
}

function formatLegTime(timeString: string): string {
    if (!timeString) {
        return "";
    }

    const timeRegex = /(?:(\d+)\.)?(\d+):(\d+)(?::(\d+))?/;
    const match = timeString.match(timeRegex);

    if (!match) {
        return timeString;
    }

    const days = match[1] ? Number(match[1]) : 0;
    const hours = Number(match[2]) + days * 24;
    const minutes = Number(match[3]);

    if (hours === 0) {
        return `${minutes} мин`;
    }

    return `${hours} ч ${minutes} мин`;
}

function formatMoney(value: number): string {
    return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

function getAirportCode(airport: Airport): string {
    return airport.iata || airport.icao;
}

function getAirportDisplayName(airport: Airport): string {
    const airportCode = getAirportCode(airport);
    const airportCity = airport.city || airport.name;

    if (!airportCode) {
        return airportCity;
    }

    return `${airportCity} (${airportCode})`;
}

function getAirportHintContent(airport: Airport): string {
    return getAirportDisplayName(airport);
}

function getAirportBalloonContent(airport: Airport): string {
    const airportCode = getAirportCode(airport);
    const airportCodeText = airportCode ? ` (${airportCode})` : "";
    const airportCity = airport.city || "Город не указан";

    return `
        <div class="airport-balloon">
            <strong>${escapeHtml(airport.name)}${escapeHtml(airportCodeText)}</strong>
            <span>${escapeHtml(airportCity)}, ${escapeHtml(airport.country)}</span>
        </div>
    `;
}

function getLegStats(leg: RouteLeg): string {
    const distance = Math.round(leg.distanceKm).toLocaleString("ru-RU");
    const flightTime = formatLegTime(leg.flightTime);
    const flightCost = formatMoney(leg.flightCost);

    return `${distance} км • ${flightTime} • ${flightCost}`;
}

function getGroundTimeText(leg: RouteLeg): string {
    if (!leg.groundTimeAfterArrival) {
        return "";
    }

    return `Стоянка в аэропорту: ${formatLegTime(leg.groundTimeAfterArrival)}`;
}

function getLegHintContent(fromAirport: Airport, toAirport: Airport, leg: RouteLeg): string {
    return `${getAirportDisplayName(fromAirport)} → ${getAirportDisplayName(toAirport)} | ${getLegStats(leg)}`;
}

function getLegBalloonContent(fromAirport: Airport, toAirport: Airport, leg: RouteLeg): string {
    const groundTimeText = getGroundTimeText(leg);
    const groundTimeHtml = groundTimeText
        ? `<span>${escapeHtml(groundTimeText)}</span>`
        : "";

    return `
        <div class="route-leg-balloon">
            <strong>${escapeHtml(getAirportDisplayName(fromAirport))} → ${escapeHtml(getAirportDisplayName(toAirport))}</strong>
            <span>${escapeHtml(getLegStats(leg))}</span>
            ${groundTimeHtml}
        </div>
    `;
}

function getRouteTitle(airports: Airport[]): string {
    if (airports.length < 2) {
        return "Маршрут";
    }

    const departureAirport = airports[0];
    const arrivalAirport = airports[airports.length - 1];

    return `${getAirportDisplayName(departureAirport)} → ${getAirportDisplayName(arrivalAirport)}`;
}

function getMapBounds(coordinates: Coordinate[]): MapBounds | undefined {
    if (coordinates.length < 2) {
        return undefined;
    }

    const latitudes = coordinates.map((coordinate) => coordinate[0]);
    const longitudes = coordinates.map((coordinate) => coordinate[1]);

    return [
        [Math.min(...latitudes), Math.min(...longitudes)],
        [Math.max(...latitudes), Math.max(...longitudes)]
    ];
}

function getAirportById(airports: Airport[], airportId: number): Airport | undefined {
    return airports.find((airport) => airport.id === airportId);
}

function getMarkerColor(index: number, airportsCount: number): string {
    if (index === 0) {
        return "#16a34a";
    }

    if (index === airportsCount - 1) {
        return "#dc2626";
    }

    return "#2563eb";
}

function createMarkerIcon(color: string): string {
    const svg = `
        <svg width="30" height="42" viewBox="0 0 30 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 1.5C7.544 1.5 1.5 7.544 1.5 15C1.5 25.5 15 40.5 15 40.5C15 40.5 28.5 25.5 28.5 15C28.5 7.544 22.456 1.5 15 1.5Z" fill="${color}" stroke="white" stroke-width="3"/>
            <circle cx="15" cy="15" r="5.5" fill="white"/>
        </svg>
    `;

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getArcSegmentCount(distanceKm: number): number {
    return Math.max(24, Math.min(120, Math.ceil(distanceKm / 150)));
}

function getGreatCircleArcCoordinates(
    fromAirport: Airport,
    toAirport: Airport,
    segmentCount: number
): Coordinate[] {
    const lat1 = toRadians(fromAirport.latitude);
    const lon1 = toRadians(fromAirport.longitude);
    const lat2 = toRadians(toAirport.latitude);
    const lon2 = toRadians(toAirport.longitude);

    const x1 = Math.cos(lat1) * Math.cos(lon1);
    const y1 = Math.cos(lat1) * Math.sin(lon1);
    const z1 = Math.sin(lat1);

    const x2 = Math.cos(lat2) * Math.cos(lon2);
    const y2 = Math.cos(lat2) * Math.sin(lon2);
    const z2 = Math.sin(lat2);

    const dot = clamp(x1 * x2 + y1 * y2 + z1 * z2, -1, 1);
    const omega = Math.acos(dot);

    if (omega < 1e-8) {
        return [
            [fromAirport.latitude, fromAirport.longitude],
            [toAirport.latitude, toAirport.longitude]
        ];
    }

    const sinOmega = Math.sin(omega);
    const coordinates: Coordinate[] = [];
    let previousLongitude: number | null = null;

    for (let index = 0; index <= segmentCount; index++) {
        const t = index / segmentCount;

        const coefficient1 = Math.sin((1 - t) * omega) / sinOmega;
        const coefficient2 = Math.sin(t * omega) / sinOmega;

        const x = coefficient1 * x1 + coefficient2 * x2;
        const y = coefficient1 * y1 + coefficient2 * y2;
        const z = coefficient1 * z1 + coefficient2 * z2;

        const vectorLength = Math.sqrt(x * x + y * y + z * z);

        const normalizedX = x / vectorLength;
        const normalizedY = y / vectorLength;
        const normalizedZ = z / vectorLength;

        const latitude = toDegrees(Math.atan2(normalizedZ, Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY)));
        const rawLongitude = toDegrees(Math.atan2(normalizedY, normalizedX));
        const longitude = normalizeLongitude(rawLongitude, previousLongitude);

        coordinates.push([latitude, longitude]);
        previousLongitude = longitude;
    }

    return coordinates;
}

export default function RouteModal({
    onClose,
    airports,
    legs,
    modelName,
    totalCost,
    totalTime
}: RouteModalProps) {
    const yandexMapsApiKey = import.meta.env.VITE_YANDEX_MAPS_API_KEY as string | undefined;

    const [mapInstance, setMapInstance] = useState<YandexMapInstance | null>(null);

    const routeTitle = useMemo(() => {
        return getRouteTitle(airports);
    }, [airports]);

    const routePolylines = useMemo<RoutePolylineItem[]>(() => {
        return legs
            .map((leg, index) => {
                const fromAirport = getAirportById(airports, leg.fromAirportId);
                const toAirport = getAirportById(airports, leg.toAirportId);

                if (fromAirport === undefined || toAirport === undefined) {
                    return null;
                }

                return {
                    key: `${leg.fromAirportId}-${leg.toAirportId}-${index}`,
                    leg,
                    fromAirport,
                    toAirport,
                    geometry: getGreatCircleArcCoordinates(
                        fromAirport,
                        toAirport,
                        getArcSegmentCount(leg.distanceKm)
                    )
                };
            })
            .filter((polyline): polyline is RoutePolylineItem => polyline !== null);
    }, [airports, legs]);

    const mapCoordinatesForBounds = useMemo(() => {
        const airportCoordinates: Coordinate[] = airports.map((airport) => [
            airport.latitude,
            airport.longitude
        ]);

        const polylineCoordinates = routePolylines.flatMap((polyline) => polyline.geometry);

        return [...airportCoordinates, ...polylineCoordinates];
    }, [airports, routePolylines]);

    const mapBounds = useMemo(() => {
        return getMapBounds(mapCoordinatesForBounds);
    }, [mapCoordinatesForBounds]);

    const mapDefaultState = mapBounds !== undefined
        ? { bounds: mapBounds }
        : { center: defaultMapCenter, zoom: 3 };

    const formattedTotalCost = totalCost !== undefined
        ? `${Math.floor(totalCost).toLocaleString("ru-RU")} ₽`
        : "";

    const modalSubtitle = formattedTotalCost
        ? `${modelName} • ${totalTime} • ${formattedTotalCost}`
        : `${modelName} • ${totalTime}`;

    useEffect(() => {
        if (mapInstance === null || mapBounds === undefined) {
            return;
        }

        mapInstance.setBounds(mapBounds, {
            checkZoomRange: true,
            zoomMargin: [80, 130, 130, 130]
        });
    }, [mapInstance, mapBounds]);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container" onClick={(event) => event.stopPropagation()}>
                <header className="modal-header">
                    <div className="header-info">
                        <h2>Маршрут: {routeTitle}</h2>
                        <span>{modalSubtitle}</span>
                    </div>

                    <button
                        type="button"
                        className="close-modal-btn"
                        onClick={onClose}
                    >
                        &times;
                    </button>
                </header>

                <div className="modal-body">
                    <div className="map-wrapper">
                        {!yandexMapsApiKey ? (
                            <div className="map-error-message">
                                Не указан ключ Яндекс.Карт
                            </div>
                        ) : (
                            <YMaps
                                query={{
                                    apikey: yandexMapsApiKey,
                                    lang: "ru_RU"
                                }}
                            >
                                <Map
                                    width="100%"
                                    height="100%"
                                    defaultState={mapDefaultState}
                                    modules={[
                                        "geoObject.addon.hint",
                                        "geoObject.addon.balloon"
                                    ]}
                                    instanceRef={(instance) => {
                                        setMapInstance(instance as YandexMapInstance | null);
                                    }}
                                    className="yandex-map-container"
                                >
                                    {routePolylines.map((polyline) => (
                                        <Polyline
                                            key={polyline.key}
                                            geometry={polyline.geometry}
                                            properties={{
                                                hintContent: getLegHintContent(
                                                    polyline.fromAirport,
                                                    polyline.toAirport,
                                                    polyline.leg
                                                ),
                                                balloonContent: getLegBalloonContent(
                                                    polyline.fromAirport,
                                                    polyline.toAirport,
                                                    polyline.leg
                                                )
                                            }}
                                            options={{
                                                strokeColor: "#2563eb",
                                                strokeWidth: 7,
                                                strokeOpacity: 0.85
                                            }}
                                        />
                                    ))}

                                    {airports.map((airport, index) => {
                                        const markerColor = getMarkerColor(index, airports.length);

                                        return (
                                            <Placemark
                                                key={airport.id}
                                                geometry={[airport.latitude, airport.longitude]}
                                                properties={{
                                                    hintContent: getAirportHintContent(airport),
                                                    balloonContent: getAirportBalloonContent(airport)
                                                }}
                                                options={{
                                                    iconLayout: "default#image",
                                                    iconImageHref: createMarkerIcon(markerColor),
                                                    iconImageSize: [30, 42],
                                                    iconImageOffset: [-15, -42],
                                                    hideIconOnBalloonOpen: false
                                                }}
                                            />
                                        );
                                    })}
                                </Map>
                            </YMaps>
                        )}
                    </div>

                    <div className="route-details-list">
                        <h3>Детали перелёта</h3>

                        <div className="legs-container">
                            {legs.map((leg, index) => {
                                const fromAirport = getAirportById(airports, leg.fromAirportId);
                                const toAirport = getAirportById(airports, leg.toAirportId);

                                if (fromAirport === undefined || toAirport === undefined) {
                                    return null;
                                }

                                return (
                                    <div
                                        key={`${leg.fromAirportId}-${leg.toAirportId}-${index}`}
                                        className="leg-item"
                                    >
                                        <div className="leg-dot-line">
                                            <div className="dot"></div>
                                            {index < legs.length - 1 && <div className="line"></div>}
                                        </div>

                                        <div className="leg-content">
                                            <div className="leg-airports">
                                                <strong>{getAirportDisplayName(fromAirport)}</strong>
                                                {" → "}
                                                <strong>{getAirportDisplayName(toAirport)}</strong>
                                            </div>

                                            <div className="leg-stats">
                                                {getLegStats(leg)}
                                            </div>

                                            {leg.groundTimeAfterArrival && (
                                                <div className="leg-ground-time">
                                                    {getGroundTimeText(leg)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
