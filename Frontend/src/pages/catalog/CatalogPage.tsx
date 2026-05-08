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

const maxFuzzyWordDistance = 2;

type CatalogSortOption =
    | "priceAsc"
    | "priceDesc"
    | "distanceDesc"
    | "speedDesc"
    | "popularityDesc";

type PriceRangeOption = {
    id: string;
    min: number;
    max: number | null;
    label: string;
    count: number;
};

const defaultSortOption: CatalogSortOption = "popularityDesc";
const sortOptions: Array<{ value: CatalogSortOption; label: string }> = [
    { value: "popularityDesc", label: "Сначала популярные" },
    { value: "priceAsc", label: "Сначала дешёвые" },
    { value: "priceDesc", label: "Сначала дорогие" },
    { value: "distanceDesc", label: "Сначала дальние" },
    { value: "speedDesc", label: "Сначала быстрые" }
];

function formatFlightTime(timeString: string | undefined): string {
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
}

function normalizeSearchText(value: string | undefined): string {
    return (value || "").trim().toLowerCase();
}

function fuzzyIncludes(target: string | undefined, query: string): boolean {
    const normalizedQuery = normalizeSearchText(query);

    if (normalizedQuery === "") {
        return true;
    }

    const normalizedTarget = normalizeSearchText(target);

    if (normalizedTarget.includes(normalizedQuery)) {
        return true;
    }

    const targetWords = normalizedTarget.split(/\s+/).filter(Boolean);
    const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);

    return queryWords.every((queryWord) =>
        targetWords.some((targetWord) =>
            targetWord.includes(queryWord) ||
            queryWord.includes(targetWord) ||
            levenshteinDistance(targetWord, queryWord) <= maxFuzzyWordDistance
        )
    );
}

function levenshteinDistance(source: string, target: string): number {
    if (source.length === 0) {
        return target.length;
    }

    if (target.length === 0) {
        return source.length;
    }

    const matrix = Array.from({ length: source.length + 1 }, () => new Array<number>(target.length + 1).fill(0));

    for (let sourceIndex = 0; sourceIndex <= source.length; sourceIndex++) {
        matrix[sourceIndex][0] = sourceIndex;
    }

    for (let targetIndex = 0; targetIndex <= target.length; targetIndex++) {
        matrix[0][targetIndex] = targetIndex;
    }

    for (let sourceIndex = 1; sourceIndex <= source.length; sourceIndex++) {
        for (let targetIndex = 1; targetIndex <= target.length; targetIndex++) {
            const cost = source[sourceIndex - 1] === target[targetIndex - 1] ? 0 : 1;
            matrix[sourceIndex][targetIndex] = Math.min(
                matrix[sourceIndex - 1][targetIndex] + 1,
                matrix[sourceIndex][targetIndex - 1] + 1,
                matrix[sourceIndex - 1][targetIndex - 1] + cost
            );
        }
    }

    return matrix[source.length][target.length];
}

function parseListParameter(value: string | null): string[] {
    return (value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function serializeListParameter(values: string[]): string {
    return values.join(",");
}

function getInitialSortOption(value: string | null): CatalogSortOption {
    return sortOptions.some((option) => option.value === value)
        ? value as CatalogSortOption
        : defaultSortOption;
}

function getCatalogPrice(plane: PlaneCatalogResponse, isRouteActive: boolean): number {
    return isRouteActive ? plane.flightCost : plane.flightHourCost;
}

function formatMoney(value: number): string {
    return `${Math.floor(value).toLocaleString("ru-RU")} ₽`;
}

function getNicePriceStep(maxPrice: number): number {
    if (maxPrice <= 0) {
        return 1;
    }

    const rawStep = maxPrice / 5;
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const normalizedStep = rawStep / magnitude;

    if (normalizedStep <= 1) {
        return magnitude;
    }

    if (normalizedStep <= 2) {
        return 2 * magnitude;
    }

    if (normalizedStep <= 5) {
        return 5 * magnitude;
    }

    return 10 * magnitude;
}

function createPriceRangeOptions(
    planes: PlaneCatalogResponse[],
    isRouteActive: boolean
): PriceRangeOption[] {
    const prices = planes
        .map((plane) => getCatalogPrice(plane, isRouteActive))
        .filter((price) => Number.isFinite(price) && price > 0);

    if (prices.length === 0) {
        return [];
    }

    const maxPrice = Math.max(...prices);
    const step = getNicePriceStep(maxPrice);
    const baseRanges = Array.from({ length: 5 }, (_, index) => ({
        id: `price-${index}`,
        min: index === 0 ? 0 : step * index + 1,
        max: index === 4 ? null : step * (index + 1)
    }));
    const ranges: PriceRangeOption[] = [];
    let nextDisplayMin = 0;

    for (let index = 0; index < baseRanges.length; index++) {
        const nextFilledRangeIndex = baseRanges.findIndex((range, rangeIndex) =>
            rangeIndex >= index &&
            prices.some((price) => isPriceInRange(price, range))
        );

        if (nextFilledRangeIndex < 0) {
            break;
        }

        const baseRange = baseRanges[nextFilledRangeIndex];
        const min = nextDisplayMin;
        const max = baseRange.max;
        const count = prices.filter((price) =>
            price >= min && (max === null || price <= max)
        ).length;

        ranges.push({
            id: baseRange.id,
            min,
            max,
            label: max === null
                ? `${formatMoney(min)} и более`
                : index === 0
                    ? `До ${formatMoney(max)}`
                    : `${formatMoney(min)} - ${formatMoney(max)}`,
            count
        });

        if (max === null) {
            break;
        }

        nextDisplayMin = max + 1;
        index = nextFilledRangeIndex;
    }

    return ranges;
}

function isPriceInRange(
    price: number,
    range: Pick<PriceRangeOption, "min" | "max">
): boolean {
    return price >= range.min && (range.max === null || price <= range.max);
}

function toggleValue(values: string[], value: string): string[] {
    return values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value];
}

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
    const [minimumPriceFilter, setMinimumPriceFilter] = useState(searchParameters.get("minPrice") || "");
    const [maximumPriceFilter, setMaximumPriceFilter] = useState(searchParameters.get("maxPrice") || "");
    const [selectedPriceRangeIds, setSelectedPriceRangeIds] = useState<string[]>(
        parseListParameter(searchParameters.get("priceRanges"))
    );
    const [airlineSearchValue, setAirlineSearchValue] = useState("");
    const [selectedAirlineNames, setSelectedAirlineNames] = useState<string[]>(
        parseListParameter(searchParameters.get("airlines"))
    );
    const [sortOption, setSortOption] = useState<CatalogSortOption>(
        getInitialSortOption(searchParameters.get("sort"))
    );

    const [selectedRoutePlane, setSelectedRoutePlane] = useState<PlaneCatalogResponse | null>(null);

    const isRouteActive = useMemo(() => {
        return takeOffAirportId.trim() !== "" && landingAirportId.trim() !== "";
    }, [takeOffAirportId, landingAirportId]);

    const routeDistance = useMemo(() => {
        if (!isRouteActive || planes.length === 0) {
            return null;
        }

        return planes.find((plane) => plane.distanceKm > 0)?.distanceKm ?? null;
    }, [planes, isRouteActive]);

    const priceRangeOptions = useMemo(() => {
        return createPriceRangeOptions(planes, isRouteActive);
    }, [planes, isRouteActive]);

    const airlineOptions = useMemo(() => {
        const airlineCounts = new Map<string, number>();

        planes.forEach((plane) => {
            const airlineName = plane.airlineName.trim();

            if (airlineName === "") {
                return;
            }

            airlineCounts.set(airlineName, (airlineCounts.get(airlineName) ?? 0) + 1);
        });

        return Array.from(airlineCounts.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((firstAirline, secondAirline) => firstAirline.name.localeCompare(secondAirline.name));
    }, [planes]);

    const filteredAirlineOptions = useMemo(() => {
        return airlineOptions.filter((airline) =>
            fuzzyIncludes(airline.name, airlineSearchValue)
        );
    }, [airlineOptions, airlineSearchValue]);

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

    function handlePriceRangeToggle(rangeId: string) {
        const nextRangeIds = toggleValue(selectedPriceRangeIds, rangeId);
        const selectedRange = priceRangeOptions.find((range) => range.id === rangeId);

        setSelectedPriceRangeIds(nextRangeIds);
        const priceUpdates: Record<string, string> = {
            priceRanges: serializeListParameter(nextRangeIds)
        };

        if (nextRangeIds.length === 1 && selectedRange !== undefined && nextRangeIds[0] === rangeId) {
            const minPrice = selectedRange.min > 0 ? selectedRange.min.toString() : "";
            const maxPrice = selectedRange.max?.toString() ?? "";

            setMinimumPriceFilter(minPrice);
            setMaximumPriceFilter(maxPrice);
            priceUpdates.minPrice = minPrice;
            priceUpdates.maxPrice = maxPrice;
        } else {
            setMinimumPriceFilter("");
            setMaximumPriceFilter("");
            priceUpdates.minPrice = "";
            priceUpdates.maxPrice = "";
        }

        updateSearchParameters(priceUpdates);
    }

    function handleAirlineToggle(airlineName: string) {
        const nextAirlineNames = toggleValue(selectedAirlineNames, airlineName);

        setSelectedAirlineNames(nextAirlineNames);
        updateSearchParameters({ airlines: serializeListParameter(nextAirlineNames) });
    }

    function handleAllAirlinesToggle() {
        const allAirlineNames = airlineOptions.map((airline) => airline.name);
        const nextAirlineNames = selectedAirlineNames.length === allAirlineNames.length
            ? []
            : allAirlineNames;

        setSelectedAirlineNames(nextAirlineNames);
        updateSearchParameters({ airlines: serializeListParameter(nextAirlineNames) });
    }

    function updateMinimumPriceFilter(value: string) {
        setMinimumPriceFilter(value);
        setSelectedPriceRangeIds([]);
        updateSearchParameters({
            minPrice: value,
            priceRanges: ""
        });
    }

    function updateMaximumPriceFilter(value: string) {
        setMaximumPriceFilter(value);
        setSelectedPriceRangeIds([]);
        updateSearchParameters({
            maxPrice: value,
            priceRanges: ""
        });
    }

    function normalizePriceBounds(changedField: "min" | "max") {
        const numericMinimumPrice = Number(minimumPriceFilter);
        const numericMaximumPrice = Number(maximumPriceFilter);
        const hasMinimumPrice = minimumPriceFilter.trim() !== "" && Number.isFinite(numericMinimumPrice);
        const hasMaximumPrice = maximumPriceFilter.trim() !== "" && Number.isFinite(numericMaximumPrice);

        if (!hasMinimumPrice || !hasMaximumPrice || numericMinimumPrice <= numericMaximumPrice) {
            return;
        }

        if (changedField === "min") {
            setMaximumPriceFilter(minimumPriceFilter);
            updateSearchParameters({ maxPrice: minimumPriceFilter });
            return;
        }

        setMinimumPriceFilter(maximumPriceFilter);
        updateSearchParameters({ minPrice: maximumPriceFilter });
    }

    function handlePriceInputKeyDown(
        event: React.KeyboardEvent<HTMLInputElement>,
        changedField: "min" | "max"
    ) {
        if (event.key === "Enter") {
            normalizePriceBounds(changedField);
        }
    }

    const filteredCatalogPlanes = useMemo(() => {
        const selectedPriceRanges = priceRangeOptions.filter((range) =>
            selectedPriceRangeIds.includes(range.id)
        );

        const filteredPlanes = planes.filter((plane) => {
            const catalogPrice = getCatalogPrice(plane, isRouteActive);
            const matchesSearch = plane.modelName.toLowerCase().includes(searchValue.toLowerCase());
            const matchesModel = plane.modelName.toLowerCase().includes(modelNameFilter.toLowerCase());
            const matchesAirline =
                selectedAirlineNames.length === 0 ||
                selectedAirlineNames.length === airlineOptions.length ||
                selectedAirlineNames.includes(plane.airlineName.trim());
            const matchesCapacity =
                !minimumPassengerCapacityFilter || plane.passengerCapacity >= Number(minimumPassengerCapacityFilter);
            const matchesDistance =
                !minimumMaxDistanceFilter || plane.maxDistance >= Number(minimumMaxDistanceFilter);
            const matchesTransfers =
                !maximumTransfersFilter ||
                (plane.numberOfTransfers !== undefined && plane.numberOfTransfers <= Number(maximumTransfersFilter));
            const matchesMinimumPrice =
                !minimumPriceFilter || catalogPrice >= Number(minimumPriceFilter);
            const matchesMaximumPrice =
                !maximumPriceFilter || catalogPrice <= Number(maximumPriceFilter);
            const matchesSelectedPriceRanges =
                selectedPriceRanges.length === 0 ||
                selectedPriceRanges.some((range) => isPriceInRange(catalogPrice, range));

            return matchesSearch &&
                matchesModel &&
                matchesAirline &&
                matchesCapacity &&
                matchesDistance &&
                matchesTransfers &&
                matchesMinimumPrice &&
                matchesMaximumPrice &&
                matchesSelectedPriceRanges;
        });

        return [...filteredPlanes].sort((firstPlane, secondPlane) => {
            switch (sortOption) {
                case "priceAsc":
                    return getCatalogPrice(firstPlane, isRouteActive) - getCatalogPrice(secondPlane, isRouteActive);
                case "priceDesc":
                    return getCatalogPrice(secondPlane, isRouteActive) - getCatalogPrice(firstPlane, isRouteActive);
                case "distanceDesc":
                    return secondPlane.maxDistance - firstPlane.maxDistance;
                case "speedDesc":
                    return secondPlane.cruisingSpeed - firstPlane.cruisingSpeed;
                case "popularityDesc":
                    return secondPlane.departureCount - firstPlane.departureCount;
                default:
                    return 0;
            }
        });
    }, [
        planes,
        searchValue,
        modelNameFilter,
        selectedAirlineNames,
        airlineOptions.length,
        minimumPassengerCapacityFilter,
        minimumMaxDistanceFilter,
        maximumTransfersFilter,
        minimumPriceFilter,
        maximumPriceFilter,
        selectedPriceRangeIds,
        priceRangeOptions,
        sortOption,
        isRouteActive
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
        setMinimumPriceFilter("");
        setMaximumPriceFilter("");
        setSelectedPriceRangeIds([]);
        setAirlineSearchValue("");
        setSelectedAirlineNames([]);
        setSortOption(defaultSortOption);
        setSearchParameters(new URLSearchParams());
    }

    return (
        <div className="catalog-wrapper">
            <Header
                showSearch={true}
                searchValue={searchValue}
                onLogoClick={resetAllFilters}
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
                        <details className="filter-block" open>
                            <summary className="filter-block-title">Маршрут</summary>

                            <div className="filter-block-content">
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
                        </details>

                        <details className="filter-block" open>
                            <summary className="filter-block-title">Сортировка</summary>

                            <div className="filter-block-content">
                                <select
                                    className="catalog-select"
                                    value={sortOption}
                                    onChange={(event) => {
                                        const value = event.target.value as CatalogSortOption;
                                        setSortOption(value);
                                        updateSearchParameters({
                                            sort: value === defaultSortOption ? "" : value
                                        });
                                    }}
                                >
                                    {sortOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </details>

                        <details className="filter-block">
                            <summary className="filter-block-title">Цена</summary>

                            <div className="filter-block-content">
                                <div className="range-fields">
                                    <div className="range-input-wrap">
                                        <input
                                            className="range-input"
                                            value={minimumPriceFilter}
                                            type="number"
                                            min="0"
                                            placeholder="от"
                                            onChange={(event) => updateMinimumPriceFilter(event.target.value)}
                                            onBlur={() => normalizePriceBounds("min")}
                                            onKeyDown={(event) => handlePriceInputKeyDown(event, "min")}
                                        />
                                        {minimumPriceFilter && (
                                            <button
                                                type="button"
                                                className="range-clear-button"
                                                onClick={() => updateMinimumPriceFilter("")}
                                                aria-label="Очистить минимальную цену"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>

                                    <div className="range-input-wrap">
                                        <input
                                            className="range-input"
                                            value={maximumPriceFilter}
                                            type="number"
                                            min="0"
                                            placeholder="до"
                                            onChange={(event) => updateMaximumPriceFilter(event.target.value)}
                                            onBlur={() => normalizePriceBounds("max")}
                                            onKeyDown={(event) => handlePriceInputKeyDown(event, "max")}
                                        />
                                        {maximumPriceFilter && (
                                            <button
                                                type="button"
                                                className="range-clear-button"
                                                onClick={() => updateMaximumPriceFilter("")}
                                                aria-label="Очистить максимальную цену"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="checkbox-stack">
                                    {priceRangeOptions.map((range) => (
                                        <label className="filter-checkbox-row" key={range.id}>
                                            <input
                                                type="checkbox"
                                                checked={selectedPriceRangeIds.includes(range.id)}
                                                onChange={() => handlePriceRangeToggle(range.id)}
                                            />
                                            <span>{range.label}</span>
                                            <span className="filter-count">({range.count})</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </details>

                        <details className="filter-block">
                            <summary className="filter-block-title">Авиакомпании</summary>

                            <div className="filter-block-content">
                                <div className="filter-search-box">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="11" cy="11" r="7"></circle>
                                        <line x1="16.5" y1="16.5" x2="21" y2="21"></line>
                                    </svg>
                                    <input
                                        value={airlineSearchValue}
                                        placeholder="Поиск"
                                        onChange={(event) => setAirlineSearchValue(event.target.value)}
                                    />
                                </div>

                                <label className="filter-checkbox-row all-airlines-row">
                                    <input
                                        type="checkbox"
                                        checked={
                                            airlineOptions.length > 0 &&
                                            selectedAirlineNames.length === airlineOptions.length
                                        }
                                        onChange={handleAllAirlinesToggle}
                                    />
                                    <span>Все авиакомпании</span>
                                </label>

                                <div className="airline-checkbox-list">
                                    {filteredAirlineOptions.map((airline) => (
                                        <label className="filter-checkbox-row" key={airline.name}>
                                            <input
                                                type="checkbox"
                                                checked={selectedAirlineNames.includes(airline.name)}
                                                onChange={() => handleAirlineToggle(airline.name)}
                                            />
                                            <span>{airline.name}</span>
                                            <span className="filter-count">({airline.count})</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </details>

                        <details className="filter-block">
                            <summary className="filter-block-title">Параметры</summary>

                            <div className="filter-block-content">
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
                        </details>
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
                                    cruisingSpeed={plane.cruisingSpeed}
                                    departureCount={plane.departureCount}
                                    imageBase64={plane.imageBase64}
                                    airlineImageBase64={plane.airlineImageBase64}
                                    flightCost={getCatalogPrice(plane, isRouteActive)}
                                    priceSuffix={isRouteActive ? "" : "/ч"}
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
