import { useEffect, useMemo, useState } from "react";
import InputField from "../../components/InputField/InputField";
import CatalogPlaneCard from "../../components/CatalogPlaneCard/CatalogPlaneCard";
import { getPlanes, getCatalogPlanes } from "../../api/planesService"; 
import type { PlaneCatalogResponse } from "../../contracts/responses/planes/planeCatalogResponse";
import "./CatalogPage.css";

export default function CatalogPage() {
    // --- Данные из API ---
    const [planes, setPlanes] = useState<PlaneCatalogResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- Состояния для расчета маршрута (ID аэропортов) ---
    // В будущем ты заменишь эти инпуты на Select-ы с поиском аэропортов
    const [takeOffAirportId, setTakeOffAirportId] = useState("");
    const [landingAirportId, setLandingAirportId] = useState("");

    // --- Состояния обычных фильтров ---
    const [searchValue, setSearchValue] = useState("");
    const [modelNameFilter, setModelNameFilter] = useState("");
    const [minimumPassengerCapacityFilter, setMinimumPassengerCapacityFilter] = useState("");
    const [minimumMaxDistanceFilter, setMinimumMaxDistanceFilter] = useState("");
    const [maximumTransfersFilter, setMaximumTransfersFilter] = useState("");

    // Логика загрузки данных
    useEffect(() => {
        const fetchPlanes = async () => {
            setIsLoading(true);
            try {
                let data: PlaneCatalogResponse[];

                // Если введены оба ID, запрашиваем расчет, иначе — обычный список
                if (takeOffAirportId && landingAirportId) {
                    data = await getCatalogPlanes(
                        Number(takeOffAirportId), 
                        Number(landingAirportId)
                    );
                } else {
                    data = await getPlanes();
                }

                setPlanes(data);
                setError(null);
            } catch (err) {
                console.error(err);
                setError("Не удалось загрузить данные о самолетах.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchPlanes();
    }, [takeOffAirportId, landingAirportId]);

    // Логика фильтрации на клиенте
    const filteredCatalogPlanes = useMemo(() => {
        return planes.filter((plane) => {
            const search = searchValue.toLowerCase();
            const matchesSearch = plane.modelName.toLowerCase().includes(search) || 
                                 (plane.flightCost?.toString() || "").includes(search);
            
            const matchesModel = plane.modelName.toLowerCase().includes(modelNameFilter.toLowerCase());
            const matchesCapacity = !minimumPassengerCapacityFilter || plane.passengerCapacity >= Number(minimumPassengerCapacityFilter);
            const matchesDist = !minimumMaxDistanceFilter || plane.maxDistance >= Number(minimumMaxDistanceFilter);
            
            // Если numberOfTransfers нет (обычный режим), фильтр по ним пропускаем
            const matchesTransfers = !maximumTransfersFilter || 
                                   (plane.numberOfTransfers !== undefined && plane.numberOfTransfers <= Number(maximumTransfersFilter));

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

                <div className="navbar-search-container">
                    <input
                        type="text"
                        className="navbar-search-input"
                        placeholder="Поиск по модели..."
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                    />
                </div>

                <div className="navbar-actions">
                    <div className="user-avatar-stub" />
                </div>
            </header>

            <div className="catalog-layout">
                <aside className="catalog-sidebar">
                    <h2 className="sidebar-heading">Маршрут</h2>
                    <div className="filters-stack" style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #eee' }}>
                        <InputField 
                            label="ID Аэропорта вылета" 
                            value={takeOffAirportId} 
                            onChange={setTakeOffAirportId} 
                            type="number"
                        />
                        <InputField 
                            label="ID Аэропорта прибытия" 
                            value={landingAirportId} 
                            onChange={setLandingAirportId} 
                            type="number"
                        />
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
                        <div className="catalog-message">Загрузка...</div>
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
                                        // Передаем данные расчета, только если они есть
                                        flightCost={plane.flightCost ? `${plane.flightCost.toLocaleString()} ₽` : ""}
                                        flightTime={plane.flightTime || ""}
                                        numberOfTransfers={plane.numberOfTransfers !== undefined ? `${plane.numberOfTransfers} пересадок` : ""}
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