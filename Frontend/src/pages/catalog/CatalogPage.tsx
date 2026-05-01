import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUser } from "../../context/UserContext";
import InputField from "../../components/inputField/InputField";
import CatalogPlaneCard from "../../components/catalogPlaneCard/CatalogPlaneCard";
import AirportSearch, { type AirportSelection } from "../../components/airportSearch/AirportSearch";
import Header from "../../components/header/Header";
import { getPlanes, getCatalogPlanes } from "../../api/planesService";
import type { PlaneCatalogResponse } from "../../contracts/responses/planes/planeCatalogResponse";
import "./CatalogPage.css";
import RouteModal from "../../components/routeModal/RouteModal";

const formatFlightTime = (timeString: string | undefined): string => {
    if (!timeString) {
        return "";
    }

    const timeRegex = /(?:(\d+)\.)?(\d+):(\d+)(?::(\d+))?/;
    const match = timeString.match(timeRegex);

    if (!match) {
        return "";
    }

    const days = match[1] ? parseInt(match[1], 10) : 0;
    const hours = parseInt(match[2], 10) + days * 24;
    const minutes = parseInt(match[3], 10);

    let formattedResult = "";

    if (hours > 0) {
        formattedResult += `${hours} ч `;
    }

    if (minutes > 0 || hours === 0) {
        formattedResult += `${minutes} мин`;
    }

    return formattedResult.trim();
};

export default function CatalogPage() {
    const navigate = useNavigate();
    const { user } = useUser();
    const [searchParameters, setSearchParameters] = useSearchParams();

    const [planes, setPlanes] = useState<PlaneCatalogResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const takeOffAirportId = searchParameters.get("from") || "";
    const landingAirportId = searchParameters.get("to") || "";
    const takeOffAirportLabel = searchParameters.get("fromLabel") || "";
    const landingAirportLabel = searchParameters.get("toLabel") || "";

    const [searchValue, setSearchValue] = useState(searchParameters.get("search") || "");
    const [modelNameFilter, setModelNameFilter] = useState(searchParameters.get("model") || "");
    const [minimumPassengerCapacityFilter, setMinimumPassengerCapacityFilter] = useState(searchParameters.get("minPassengers") || "");
    const [minimumMaxDistanceFilter, setMinimumMaxDistanceFilter] = useState(searchParameters.get("minDistance") || "");
    const [maximumTransfersFilter, setMaximumTransfersFilter] = useState(searchParameters.get("maxTransfers") || "");

    const [selectedRoutePlane, setSelectedRoutePlane] = useState<PlaneCatalogResponse | null>(null);
    
    const isRouteActive = useMemo(() => {
        return takeOffAirportId.trim() !== "" && landingAirportId.trim() !== "";
    }, [takeOffAirportId, landingAirportId]);

    const routeDistance = useMemo(() => {
        if (!isRouteActive || planes.length === 0) {
            return null;
        }

        return planes[0].distanceKm || null;
    }, [planes, isRouteActive]);

    useEffect(() => {
        fetchPlanesData();
    }, [takeOffAirportId, landingAirportId, isRouteActive]);

    async function fetchPlanesData() {
        setIsLoading(true);

        try {
            const data = isRouteActive
                ? await getCatalogPlanes(Number(takeOffAirportId), Number(landingAirportId))
                : await getPlanes();

            setPlanes(data);
            setErrorMessage(null);
        } catch {
            setErrorMessage("Ошибка загрузки данных");
        } finally {
            setIsLoading(false);
        }
    }

    function updateSearchParameters(updates: Record<string, string>) {
        const updatedSearchParameters = new URLSearchParams(searchParameters);

        Object.entries(updates).forEach(([name, value]) => {
            if (value.trim() === "") {
                updatedSearchParameters.delete(name);
                return;
            }

            updatedSearchParameters.set(name, value);
        });

        setSearchParameters(updatedSearchParameters);
    }

    function handleTakeOffAirportSelect(airport: AirportSelection) {
        updateSearchParameters({
            from: airport.id,
            fromLabel: airport.displayName
        });
    }

    function handleLandingAirportSelect(airport: AirportSelection) {
        updateSearchParameters({
            to: airport.id,
            toLabel: airport.displayName
        });
    }

    const filteredCatalogPlanes = useMemo(() => {
        return planes.filter((plane) => {
            const matchesSearch = plane.modelName.toLowerCase().includes(searchValue.toLowerCase());
            const matchesModel = plane.modelName.toLowerCase().includes(modelNameFilter.toLowerCase());
            const matchesCapacity =
                !minimumPassengerCapacityFilter || plane.passengerCapacity >= Number(minimumPassengerCapacityFilter);
            const matchesDistance =
                !minimumMaxDistanceFilter || plane.maxDistance >= Number(minimumMaxDistanceFilter);
            const matchesTransfers =
                !maximumTransfersFilter ||
                (plane.numberOfTransfers !== undefined && plane.numberOfTransfers <= Number(maximumTransfersFilter));

            return matchesSearch && matchesModel && matchesCapacity && matchesDistance && matchesTransfers;
        });
    }, [
        planes,
        searchValue,
        modelNameFilter,
        minimumPassengerCapacityFilter,
        minimumMaxDistanceFilter,
        maximumTransfersFilter
    ]);

    function handleOrderNavigation(plane: PlaneCatalogResponse) {
        if (!user) {
            navigate("/login");
            return;
        }

        const orderSearchParameters = new URLSearchParams();

        orderSearchParameters.set("planeId", plane.id.toString());
        orderSearchParameters.set("modelName", plane.modelName);

        if (takeOffAirportId.trim() !== "") {
            orderSearchParameters.set("from", takeOffAirportId);
        }

        if (landingAirportId.trim() !== "") {
            orderSearchParameters.set("to", landingAirportId);
        }

        if (takeOffAirportLabel.trim() !== "") {
            orderSearchParameters.set("fromLabel", takeOffAirportLabel);
        }

        if (landingAirportLabel.trim() !== "") {
            orderSearchParameters.set("toLabel", landingAirportLabel);
        }

        navigate(
            {
                pathname: "/create-order",
                search: orderSearchParameters.toString()
            },
            {
                state: {
                    imageBase64: plane.imageBase64,
                    flightCost: plane.flightCost
                }
            }
        );
    }

    function resetAllFilters() {
        setSearchValue("");
        setModelNameFilter("");
        setMinimumPassengerCapacityFilter("");
        setMinimumMaxDistanceFilter("");
        setMaximumTransfersFilter("");
        setSearchParameters(new URLSearchParams());
    }

    return (
        <div className="catalog-wrapper">
            <Header
                showSearch={true}
                searchValue={searchValue}
                onSearchChange={(value) => {
                    setSearchValue(value);
                    updateSearchParameters({ search: value });
                }}
            >
                <button
                    className="header-icon-btn"
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="4" y1="6" x2="20" y2="6"></line>
                        <line x1="4" y1="12" x2="20" y2="12"></line>
                        <line x1="4" y1="18" x2="20" y2="18"></line>
                    </svg>
                </button>
            </Header>

            <div className={`catalog-layout ${!isSidebarOpen ? "sidebar-closed" : ""}`}>
                <aside className="catalog-sidebar">
                    <div className="sidebar-content">
                        <h2 className="sidebar-heading">Маршрут</h2>

                        <div className="filters-stack" style={{ marginBottom: "32px" }}>
                            <AirportSearch
                                label="Вылет"
                                selectedAirportId={takeOffAirportId}
                                selectedAirportDisplayName={takeOffAirportLabel}
                                onSelect={handleTakeOffAirportSelect}
                            />

                            <AirportSearch
                                label="Прибытие"
                                selectedAirportId={landingAirportId}
                                selectedAirportDisplayName={landingAirportLabel}
                                onSelect={handleLandingAirportSelect}
                            />

                            {routeDistance !== null && (
                                <div className="route-info">
                                    <span>Расстояние: {routeDistance} км</span>
                                </div>
                            )}
                        </div>

                        <h2 className="sidebar-heading">Фильтры</h2>

                        <div className="filters-stack">
                            <InputField
                                label="Модель самолёта"
                                value={modelNameFilter}
                                onChange={(value) => {
                                    setModelNameFilter(value);
                                    updateSearchParameters({ model: value });
                                }}
                            />
                            <InputField
                                label="Минимум мест"
                                value={minimumPassengerCapacityFilter}
                                onChange={(value) => {
                                    setMinimumPassengerCapacityFilter(value);
                                    updateSearchParameters({ minPassengers: value });
                                }}
                                type="number"
                            />
                            <InputField
                                label="Мин. дальность (км)"
                                value={minimumMaxDistanceFilter}
                                onChange={(value) => {
                                    setMinimumMaxDistanceFilter(value);
                                    updateSearchParameters({ minDistance: value });
                                }}
                                type="number"
                            />
                            <InputField
                                label="Макс. пересадок"
                                value={maximumTransfersFilter}
                                onChange={(value) => {
                                    setMaximumTransfersFilter(value);
                                    updateSearchParameters({ maxTransfers: value });
                                }}
                                type="number"
                            />
                        </div>
                    </div>

                    <button className="reset-filters-btn" onClick={resetAllFilters}>
                        Сбросить всё
                    </button>
                </aside>

                <main className="catalog-main">
                    {isLoading ? (
                        <div className="catalog-message">Загрузка данных...</div>
                    ) : errorMessage ? (
                        <div className="catalog-message error">{errorMessage}</div>
                    ) : (
                        <div className="catalog-results-grid">
                            {filteredCatalogPlanes.map((plane) => (
                                <CatalogPlaneCard
                                    key={plane.id}
                                    modelName={plane.modelName}
                                    passengerCapacity={plane.passengerCapacity}
                                    maxDistance={plane.maxDistance}
                                    imageBase64={plane.imageBase64}
                                    flightCost={isRouteActive ? plane.flightCost : undefined}
                                    flightTime={isRouteActive ? formatFlightTime(plane.flightTime) : ""}
                                    numberOfTransfers={
                                        isRouteActive && plane.numberOfTransfers !== undefined
                                            ? plane.numberOfTransfers.toString()
                                            : "0"
                                    }
                                    routeAirports={plane.routeAirports}
                                    routeLegs={plane.routeLegs}
                                    onRouteClick={() => setSelectedRoutePlane(plane)}
                                    onOrderClick={() => handleOrderNavigation(plane)}
                                />
                            ))}
                        </div>
                    )}
                </main>
            </div>

            {selectedRoutePlane !== null && selectedRoutePlane.routeAirports !== undefined && (
                <RouteModal
                    onClose={() => setSelectedRoutePlane(null)}
                    airports={selectedRoutePlane.routeAirports}
                    legs={selectedRoutePlane.routeLegs || []}
                    modelName={selectedRoutePlane.modelName}
                    totalCost={selectedRoutePlane.flightCost}
                    totalTime={formatFlightTime(selectedRoutePlane.flightTime)}
                />
            )}
        </div>
    );
}
