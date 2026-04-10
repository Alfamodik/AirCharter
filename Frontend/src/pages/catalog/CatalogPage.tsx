import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import InputField from "../../components/InputField/InputField";
import CatalogPlaneCard from "../../components/CatalogPlaneCard/CatalogPlaneCard";
import AirportSearch from "../../components/AirportSearch/AirportSearch";
import Header from "../../components/Header/Header";
import { getPlanes, getCatalogPlanes } from "../../api/planesService"; 
import type { PlaneCatalogResponse } from "../../contracts/responses/planes/planeCatalogResponse";
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
    const navigate = useNavigate();
    const [planes, setPlanes] = useState<PlaneCatalogResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const [takeOffAirportId, setTakeOffAirportId] = useState("");
    const [landingAirportId, setLandingAirportId] = useState("");

    const [searchValue, setSearchValue] = useState("");
    const [modelNameFilter, setModelNameFilter] = useState("");
    const [minimumPassengerCapacityFilter, setMinimumPassengerCapacityFilter] = useState("");
    const [minimumMaxDistanceFilter, setMinimumMaxDistanceFilter] = useState("");
    const [maximumTransfersFilter, setMaximumTransfersFilter] = useState("");

    const isRouteActive = useMemo(() => {
        return takeOffAirportId.trim() !== "" && landingAirportId.trim() !== "";
    }, [takeOffAirportId, landingAirportId]);

    const routeDistance = useMemo(() => {
        if (!isRouteActive) return null;
        const planeWithDist = planes.find(p => p.distanceKm && p.distanceKm > 0);
        return planeWithDist ? planeWithDist.distanceKm : null;
    }, [planes, isRouteActive]);

    useEffect(() => {
        const fetchPlanes = async () => {
            setIsLoading(true);
            try {
                let data: PlaneCatalogResponse[];
                if (isRouteActive) {
                    data = await getCatalogPlanes(Number(takeOffAirportId), Number(landingAirportId));
                } else {
                    data = await getPlanes();
                }
                setPlanes(data);
                setError(null);
            } catch (err) {
                setError("Ошибка загрузки данных");
            } finally {
                setIsLoading(false);
            }
        };
        fetchPlanes();
    }, [takeOffAirportId, landingAirportId, isRouteActive]);

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

    const handleOrder = (plane: PlaneCatalogResponse) => {
        navigate("/create-order", { 
            state: { 
                planeId: plane.id,
                modelName: plane.modelName,
                takeOffAirportId,
                landingAirportId,
                flightCost: plane.flightCost
            } 
        });
    };

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
            <Header 
                showSearch={true} 
                searchValue={searchValue} 
                onSearchChange={setSearchValue}
            >
                <button 
                    className="header-icon-btn"
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                >
                    <svg viewBox="0 0 24 24">
                        <line x1="4" y1="6" x2="20" y2="6"></line>
                        <line x1="4" y1="12" x2="20" y2="12"></line>
                        <line x1="4" y1="18" x2="20" y2="18"></line>
                    </svg>
                </button>
            </Header>

            <div className={`catalog-layout ${!isSidebarOpen ? 'sidebar-closed' : ''}`}>
                <aside className="catalog-sidebar">
                    <div className="sidebar-content">
                        <h2 className="sidebar-heading">Маршрут</h2>
                        <div className="filters-stack" style={{ marginBottom: '32px' }}>
                            <AirportSearch 
                                label="Вылет" 
                                value={takeOffAirportId} 
                                onSelect={setTakeOffAirportId} 
                            />
                            <AirportSearch 
                                label="Прибытие" 
                                value={landingAirportId} 
                                onSelect={setLandingAirportId} 
                            />
                            
                            {routeDistance && (
                                <div className="route-info">
                                    <span>Расстояние: {routeDistance} км</span>
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
                            {filteredCatalogPlanes.map((plane) => (
                                <CatalogPlaneCard 
                                    key={plane.id} 
                                    modelName={plane.modelName}
                                    passengerCapacity={plane.passengerCapacity}
                                    maxDistance={plane.maxDistance}
                                    planeImageBytes={plane.imageBase64}
                                    flightCost={isRouteActive && plane.flightCost ? `${plane.flightCost.toLocaleString('ru-RU')} ₽` : ""}
                                    flightTime={isRouteActive ? formatFlightTime(plane.flightTime) : ""}
                                    numberOfTransfers={isRouteActive && plane.numberOfTransfers !== undefined ? `${plane.numberOfTransfers}` : ""}
                                    onOrderClick={() => handleOrder(plane)}
                                />
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}