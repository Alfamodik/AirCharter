import { useEffect, useMemo, useState } from "react";
import InputField from "../../components/InputField/InputField";
import CatalogPlaneCard from "../../components/CatalogPlaneCard/CatalogPlaneCard";
import { getPlanes, getCatalogPlanes } from "../../api/planesService"; 
import type { PlaneResponse } from "../../contracts/responses/planes/planeResponse";
import "./CatalogPage.css";

const formatFlightTime = (timeStr: string | undefined): string => {
    if (!timeStr) return "";
    const regex = /(?:(\d+)\.)?(\d+):(\d+):/;
    const match = timeStr.match(regex);
    if (!match) return "";

    const days = match[1] ? parseInt(match[1], 10) : 0;
    let hours = parseInt(match[2], 10) + (days * 24);
    const minutes = parseInt(match[3], 10);

    let result = "";
    if (hours > 0) result += `${hours} ч `;
    if (minutes > 0 || hours === 0) result += `${minutes} мин`;
    
    return result.trim();
};

export default function CatalogPage() {
    // Данные и состояния
    const [planes, setPlanes] = useState<PlaneResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Маршрут
    const [takeOffAirportId, setTakeOffAirportId] = useState("");
    const [landingAirportId, setLandingAirportId] = useState("");

    // Фильтры
    const [searchValue, setSearchValue] = useState("");
    const [modelNameFilter, setModelNameFilter] = useState("");
    const [minimumPassengerCapacityFilter, setMinimumPassengerCapacityFilter] = useState("");
    const [minimumMaxDistanceFilter, setMinimumMaxDistanceFilter] = useState("");
    const [maximumTransfersFilter, setMaximumTransfersFilter] = useState("");

    // Проверка: идет ли сейчас режим расчета маршрута
    const isRouteActive = useMemo(() => {
        return takeOffAirportId.trim() !== "" && landingAirportId.trim() !== "";
    }, [takeOffAirportId, landingAirportId]);

    // Расстояние (показываем только если маршрут активен)
    const routeDistance = useMemo(() => {
        if (!isRouteActive) return null;
        const planeWithDist = planes.find(p => p.distanceKm && p.distanceKm > 0);
        return planeWithDist ? planeWithDist.distanceKm : null;
    }, [planes, isRouteActive]);

    // Загрузка данных
    useEffect(() => {
        const fetchPlanes = async () => {
            setIsLoading(true);
            try {
                let data: PlaneResponse[];
                if (isRouteActive) {
                    data = await getCatalogPlanes(Number(takeOffAirportId), Number(landingAirportId));
                } else {
                    data = await getPlanes();
                }
                setPlanes(data);
                setError(null);
            } catch (err) {
                console.error(err);
                setError("Не удалось загрузить данные");
            } finally {
                setIsLoading(false);
            }
        };
        fetchPlanes();
    }, [takeOffAirportId, landingAirportId, isRouteActive]);

    // Фильтрация
    const filteredCatalogPlanes = useMemo(() => {
        return planes.filter((plane) => {
            const matchesSearch = plane.modelName.toLowerCase().includes(searchValue.toLowerCase());
            const matchesModel = plane.modelName.toLowerCase().includes(modelNameFilter.toLowerCase());
            const matchesCapacity = !minimumPassengerCapacityFilter || plane.passengerCapacity >= Number(minimumPassengerCapacityFilter);
            const matchesDist = !minimumMaxDistanceFilter || plane.maxDistance >= Number(minimumMaxDistanceFilter);
            const matchesTransfers = !maximumTransfersFilter || (plane.numberOfTransfers !== undefined && plane.numberOfTransfers <= Number(maximumTransfersFilter));

            return matchesSearch && matchesModel && matchesCapacity && matchesDist && matchesTransfers;
        });
    }, [planes, searchValue, modelNameFilter, minimumPassengerCapacityFilter, minimumMaxDistanceFilter, maximumTransfersFilter]);

    const clearFilters = () => {
        setSearchValue("");
        setModelNameFilter("");
        setMinimumPassengerCapacityFilter("");
        setMinimumMaxDistanceFilter("");
        setMaximumTransfersFilter("");
        setTakeOffAirportId("");
        setLandingAirportId("");
    };

    return (
        <div className="catalog-wrapper">
            <header className="catalog-navbar">
                <div className="navbar-logo">
                    <button className="back-btn">←</button>
                    <span className="logo-text">AirCharter</span>
                </div>

                {/* ВЕРНУЛ ПОИСК В ЦЕНТР: этот пустой div отодвигает поиск от логотипа */}
                <div className="navbar-spacer" style={{ flex: 1 }} />

                <div className="navbar-search-container">
                    <input
                        type="text"
                        className="navbar-search-input"
                        placeholder="Поиск по модели..."
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                    />
                </div>

                {/* Этот пустой div центрирует поиск относительно всего экрана */}
                <div className="navbar-spacer" style={{ flex: 1 }} />

                <div className="navbar-actions">
                    <div className="user-avatar-stub" />
                </div>
            </header>

            <div className="catalog-layout">
                <aside className="catalog-sidebar">
                    <h2 className="sidebar-heading">Маршрут</h2>
                    <div className="filters-stack" style={{ marginBottom: '24px' }}>
                        <InputField label="ID Аэропорта вылета" value={takeOffAirportId} onChange={setTakeOffAirportId} type="number" />
                        <InputField label="ID Аэропорта прибытия" value={landingAirportId} onChange={setLandingAirportId} type="number" />
                        
                        {routeDistance && (
                            <div style={{ marginTop: '12px', fontSize: '14px', color: '#ccc' }}>
                                <span style={{ color: '#4dabf7', fontWeight: 600 }}>Расстояние: {routeDistance} км</span>
                            </div>
                        )}
                    </div>

                    <h2 className="sidebar-heading">Фильтры</h2>
                    <div className="filters-stack">
                        <InputField label="Модель самолёта" value={modelNameFilter} onChange={setModelNameFilter} />
                        <InputField label="Минимум мест" value={minimumPassengerCapacityFilter} onChange={setMinimumPassengerCapacityFilter} type="number" />
                        <InputField label="Мин. дальность (км)" value={minimumMaxDistanceFilter} onChange={setMinimumMaxDistanceFilter} type="number" />
                        <InputField label="Макс. пересадок" value={maximumTransfersFilter} onChange={setMaximumTransfersFilter} type="number" />
                    </div>
                    <button className="reset-filters-btn" onClick={clearFilters}>
                        Сбросить всё
                    </button>
                </aside>

                <main className="catalog-main">
                    {isLoading ? (
                        <div className="catalog-message">Загрузка данных...</div>
                    ) : error ? (
                        <div className="catalog-message error">{error}</div>
                    ) : (
                        <div className="catalog-results-grid">
                            {filteredCatalogPlanes.length > 0 ? (
                                filteredCatalogPlanes.map((plane) => (
                                    <CatalogPlaneCard 
                                        key={plane.id} 
                                        modelName={plane.modelName}
                                        passengerCapacity={plane.passengerCapacity}
                                        maxDistance={plane.maxDistance}
                                        planeImageBytes={plane.imageBase64}
                                        // Данные расчета передаются ТОЛЬКО если введены аэропорты
                                        flightCost={isRouteActive && plane.flightCost ? `${plane.flightCost.toLocaleString('ru-RU')} ₽` : ""}
                                        flightTime={isRouteActive ? formatFlightTime(plane.flightTime) : ""}
                                        numberOfTransfers={isRouteActive && plane.numberOfTransfers !== undefined ? `${plane.numberOfTransfers}` : ""}
                                    />
                                ))
                            ) : (
                                <div className="catalog-message">Самолёты не найдены</div>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}