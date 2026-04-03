import { useMemo, useState } from "react";
import InputField from "../../components/InputField/InputField";
import CatalogPlaneCard from "../../components/CatalogPlaneCard/CatalogPlaneCard";
import "./CatalogPage.css";

type CatalogPlane = {
    id: number;
    airlineImageUrl?: string;
    planeImageUrl?: string;
    modelName: string;
    passengerCapacity: number;
    maxDistance: number;
    flightCost: string;
    flightTime: string;
    numberOfTransfers: string;
};

const catalogPlanes: CatalogPlane[] = [
    {
        id: 1,
        modelName: "Cessna Citation XLS+",
        passengerCapacity: 8,
        maxDistance: 3441,
        flightCost: "1 250 000 ₽",
        flightTime: "2 ч 15 мин",
        numberOfTransfers: "0 пересадок"
    },
    {
        id: 2,
        modelName: "Bombardier Challenger 350",
        passengerCapacity: 9,
        maxDistance: 5926,
        flightCost: "2 840 000 ₽",
        flightTime: "4 ч 05 мин",
        numberOfTransfers: "1 пересадка"
    },
    {
        id: 3,
        modelName: "Embraer Legacy 600",
        passengerCapacity: 13,
        maxDistance: 6019,
        flightCost: "3 100 000 ₽",
        flightTime: "4 ч 40 мин",
        numberOfTransfers: "1 пересадка"
    },
    {
        id: 4,
        modelName: "Gulfstream G650",
        passengerCapacity: 18,
        maxDistance: 12964,
        flightCost: "6 900 000 ₽",
        flightTime: "8 ч 30 мин",
        numberOfTransfers: "0 пересадок"
    }
];

export default function CatalogPage() {
    const [searchValue, setSearchValue] = useState("");
    const [modelNameFilter, setModelNameFilter] = useState("");
    const [minimumPassengerCapacityFilter, setMinimumPassengerCapacityFilter] = useState("");
    const [minimumMaxDistanceFilter, setMinimumMaxDistanceFilter] = useState("");
    const [maximumTransfersFilter, setMaximumTransfersFilter] = useState("");

    const filteredCatalogPlanes = useMemo(() => {
        return catalogPlanes.filter((plane) => {
            const search = searchValue.toLowerCase();
            const matchesSearch = plane.modelName.toLowerCase().includes(search) || 
                                 plane.flightCost.toLowerCase().includes(search);
            
            const matchesModel = plane.modelName.toLowerCase().includes(modelNameFilter.toLowerCase());
            const matchesCapacity = !minimumPassengerCapacityFilter || plane.passengerCapacity >= Number(minimumPassengerCapacityFilter);
            const matchesDist = !minimumMaxDistanceFilter || plane.maxDistance >= Number(minimumMaxDistanceFilter);
            
            const transfers = parseInt(plane.numberOfTransfers) || 0;
            const matchesTransfers = !maximumTransfersFilter || transfers <= Number(maximumTransfersFilter);

            return matchesSearch && matchesModel && matchesCapacity && matchesDist && matchesTransfers;
        });
    }, [searchValue, modelNameFilter, minimumPassengerCapacityFilter, minimumMaxDistanceFilter, maximumTransfersFilter]);

    const clearFilters = () => {
        setSearchValue("");
        setModelNameFilter("");
        setMinimumPassengerCapacityFilter("");
        setMinimumMaxDistanceFilter("");
        setMaximumTransfersFilter("");
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
                        placeholder="Поиск по модели или цене..."
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
                    <h2 className="sidebar-heading">Фильтры</h2>
                    <div className="filters-stack">
                        <InputField label="Модель самолёта" value={modelNameFilter} onChange={setModelNameFilter} />
                        <InputField label="Минимум мест" value={minimumPassengerCapacityFilter} onChange={setMinimumPassengerCapacityFilter} type="number" />
                        <InputField label="Мин. дальность (км)" value={minimumMaxDistanceFilter} onChange={setMinimumMaxDistanceFilter} type="number" />
                        <InputField label="Макс. пересадок" value={maximumTransfersFilter} onChange={setMaximumTransfersFilter} type="number" />
                    </div>
                    <button className="reset-filters-btn" onClick={clearFilters}>
                        Сбросить фильтры
                    </button>
                </aside>

                <main className="catalog-main">
                    <div className="catalog-results-grid">
                        {filteredCatalogPlanes.map((plane) => (
                            <CatalogPlaneCard key={plane.id} {...plane} />
                        ))}
                    </div>
                </main>
            </div>
        </div>
    );
}