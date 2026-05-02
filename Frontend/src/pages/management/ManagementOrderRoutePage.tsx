import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { YMaps, Map, Placemark, Polyline } from "@pbe/react-yandex-maps";
import Header from "../../components/header/Header";
import AirportSearch from "../../components/airportSearch/AirportSearch";
import {
    approveManagementDepartureRoute,
    getManagementDeparture,
    getManagementRouteCandidates,
    previewManagementDepartureRoute,
    rejectManagementDeparture,
    saveManagementDepartureRoute,
    type ManagementRouteCandidateResponse,
    type ManagementRoutePreviewLegResponse,
    type ManagementRoutePreviewResponse,
    type UpdateDepartureRouteRequest
} from "../../api/managementService";
import { hasManagementAccess } from "../../api/utils/roleAccess";
import {
    getUserDeparture,
    previewUserDepartureRoute,
    saveUserDepartureRoute
} from "../../api/userService";
import { useUser } from "../../context/UserContext";
import type {
    ManagementDepartureResponse,
    ManagementRouteAirportResponse,
    ManagementRouteLegResponse
} from "../../contracts/responses/departures/managementDepartureResponse";
import type { AirportSearchResponse } from "../../contracts/responses/airports/airportSearchResponse";
import {
    buildAirportLabel,
    formatDateTime,
    formatDuration,
    formatNumber,
    formatOptionalDateTime,
    formatPrice
} from "./ManagementPage";
import "./ManagementPage.css";

type RoutePoint = {
    key: string;
    airportId: number | null;
    displayName: string;
    airport?: ManagementRouteAirportResponse | AirportSearchResponse;
};

type Coordinate = [number, number];
type MapBounds = [[number, number], [number, number]];

type YandexMapInstance = {
    setBounds: (
        bounds: MapBounds,
        options: {
            checkZoomRange: boolean;
            zoomMargin: [number, number, number, number];
        }
    ) => void;
};

type MapRouteLeg = {
    fromAirportId: number;
    toAirportId: number;
    distanceKm: number;
    canFly: boolean;
};

type ManagementOrderRoutePageProps = {
    mode?: "management" | "client";
};

export default function ManagementOrderRoutePage({
    mode = "management"
}: ManagementOrderRoutePageProps) {
    const navigate = useNavigate();
    const { departureId } = useParams();
    const { user, isLoading: isUserLoading } = useUser();

    const parsedDepartureId = Number(departureId);
    const [departure, setDeparture] = useState<ManagementDepartureResponse | null>(null);
    const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
    const [groundTimesMinutes, setGroundTimesMinutes] = useState<Array<number | null>>([]);
    const [routePreview, setRoutePreview] = useState<ManagementRoutePreviewResponse | null>(null);
    const [routeCandidates, setRouteCandidates] = useState<ManagementRouteCandidateResponse[]>([]);
    const [activeCandidatePointIndex, setActiveCandidatePointIndex] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [mapInstance, setMapInstance] = useState<YandexMapInstance | null>(null);

    const invalidSameAirportLegIndexes = useMemo(() => {
        return createSameAirportLegIndexSet(routePoints);
    }, [routePoints]);

    const routeRequest = useMemo(() => {
        if (routePoints.length < 2 || routePoints.some((routePoint) => routePoint.airportId === null)) {
            return null;
        }

        return createRouteRequest(routePoints, groundTimesMinutes);
    }, [groundTimesMinutes, invalidSameAirportLegIndexes, routePoints]);

    const summaryDistance = routePreview?.distance ?? departure?.distance ?? 0;
    const summaryFlightTime = routePreview?.flightTime ?? departure?.flightTime ?? "00:00:00";
    const summaryPrice = routePreview?.price ?? departure?.price ?? 0;
    const summaryTransfers = routePreview?.transfers ?? departure?.transfers ?? 0;
    const normalizedActiveCandidatePointIndex = getActiveCandidatePointIndex(
        routePoints,
        activeCandidatePointIndex
    );
    const mapAirports = useMemo(() => {
        return createMapAirportsFromRoutePoints(
            routePoints,
            routePreview,
            departure?.routeAirports ?? []
        );
    }, [departure?.routeAirports, routePoints, routePreview]);
    const mapLegs = useMemo(() => {
        return createMapLegsFromRoutePoints(
            routePoints,
            routePreview,
            departure?.routeLegs ?? []
        );
    }, [departure?.routeLegs, routePoints, routePreview]);

    useEffect(() => {
        if (
            isUserLoading ||
            user === null ||
            (mode === "management" && !hasManagementAccess(user.role?.name)) ||
            Number.isNaN(parsedDepartureId)
        ) {
            return;
        }

        const abortController = new AbortController();

        async function loadDeparture() {
            setIsLoading(true);
            setErrorMessage("");

            try {
                const response = mode === "management"
                    ? await getManagementDeparture(parsedDepartureId, abortController.signal)
                    : await getUserDeparture(parsedDepartureId, abortController.signal);

                setDeparture(response);
                setRoutePoints(createInitialRoutePoints(response));
                setGroundTimesMinutes(createInitialGroundTimes(response));
            } catch {
                if (!abortController.signal.aborted) {
                    setErrorMessage("Не удалось загрузить заявку.");
                }
            } finally {
                if (!abortController.signal.aborted) {
                    setIsLoading(false);
                }
            }
        }

        loadDeparture();

        return () => abortController.abort();
    }, [isUserLoading, mode, parsedDepartureId, user]);

    useEffect(() => {
        if (routeRequest === null || Number.isNaN(parsedDepartureId)) {
            setRoutePreview(null);
            return;
        }

        const abortController = new AbortController();
        const timeoutId = window.setTimeout(async () => {
            try {
                const response = mode === "management"
                    ? await previewManagementDepartureRoute(
                        parsedDepartureId,
                        routeRequest,
                        abortController.signal
                    )
                    : await previewUserDepartureRoute(
                        parsedDepartureId,
                        routeRequest,
                        abortController.signal
                    );

                setRoutePreview(response);
            } catch {
                if (!abortController.signal.aborted) {
                    setRoutePreview(null);
                }
            }
        }, 350);

        return () => {
            abortController.abort();
            window.clearTimeout(timeoutId);
        };
    }, [mode, parsedDepartureId, routeRequest]);

    useEffect(() => {
        if (
            mode !== "management" ||
            departure === null ||
            normalizedActiveCandidatePointIndex === null ||
            Number.isNaN(parsedDepartureId)
        ) {
            setRouteCandidates([]);
            return;
        }

        const fromAirportId = routePoints[normalizedActiveCandidatePointIndex - 1]?.airportId;

        if (fromAirportId === null || fromAirportId === undefined) {
            setRouteCandidates([]);
            return;
        }

        const currentFromAirportId = fromAirportId;
        const abortController = new AbortController();

        async function loadRouteCandidates() {
            try {
                const response = await getManagementRouteCandidates(
                    parsedDepartureId,
                    currentFromAirportId,
                    abortController.signal
                );

                setRouteCandidates(response);
            } catch {
                if (!abortController.signal.aborted) {
                    setRouteCandidates([]);
                }
            }
        }

        loadRouteCandidates();

        return () => abortController.abort();
    }, [departure, mode, normalizedActiveCandidatePointIndex, parsedDepartureId, routePoints]);

    const routeMapData = useMemo(() => {
        return createRouteMapData(mapAirports, mapLegs, routeCandidates);
    }, [mapAirports, mapLegs, routeCandidates]);

    useEffect(() => {
        if (mapInstance === null || routeMapData.bounds === undefined) {
            return;
        }

        mapInstance.setBounds(routeMapData.bounds, {
            checkZoomRange: true,
            zoomMargin: [55, 55, 55, 55]
        });
    }, [mapInstance, routeMapData.bounds]);

    if (!isUserLoading && (
        user === null ||
        (mode === "management" && !hasManagementAccess(user.role?.name))
    )) {
        return <Navigate to="/catalog" replace />;
    }

    if (Number.isNaN(parsedDepartureId)) {
        return <Navigate to={mode === "management" ? "/management/orders" : "/cabinet"} replace />;
    }

    function handleAirportSelect(
        routePointIndex: number,
        airportId: string,
        displayName: string,
        airport: AirportSearchResponse
    ) {
        setRoutePoints((currentRoutePoints) =>
            currentRoutePoints.map((routePoint, index) =>
                index === routePointIndex
                    ? {
                        ...routePoint,
                        airportId: Number(airportId),
                        displayName,
                        airport
                    }
                    : routePoint
            )
        );
    }

    function handleRouteCandidateSelect(candidate: ManagementRouteCandidateResponse) {
        if (normalizedActiveCandidatePointIndex === null) {
            return;
        }

        handleAirportSelect(
            normalizedActiveCandidatePointIndex,
            candidate.id.toString(),
            getAirportDisplayName(candidate),
            candidate
        );
    }

    function handleInsertPointBefore(rightPointIndex: number) {
        setRoutePoints((currentRoutePoints) => {
            const insertIndex = Math.min(
                Math.max(rightPointIndex, 1),
                currentRoutePoints.length - 1
            );
            const nextRoutePoints = [...currentRoutePoints];

            nextRoutePoints.splice(insertIndex, 0, {
                key: crypto.randomUUID(),
                airportId: null,
                displayName: ""
            });

            setActiveCandidatePointIndex(insertIndex);

            return nextRoutePoints;
        });

        setGroundTimesMinutes((currentGroundTimes) => {
            const insertIndex = Math.min(
                Math.max(rightPointIndex - 1, 0),
                currentGroundTimes.length
            );
            const nextGroundTimes = [...currentGroundTimes];

            nextGroundTimes.splice(insertIndex, 0, 90);

            return nextGroundTimes;
        });
    }

    function handleRemovePoint(routePointIndex: number) {
        setRoutePoints((currentRoutePoints) =>
            currentRoutePoints.filter((_, index) => index !== routePointIndex)
        );
        setActiveCandidatePointIndex((currentIndex) => {
            if (currentIndex === null) {
                return null;
            }

            if (currentIndex === routePointIndex) {
                return null;
            }

            return currentIndex > routePointIndex
                ? currentIndex - 1
                : currentIndex;
        });

        setGroundTimesMinutes((currentGroundTimes) => {
            const nextGroundTimes = [...currentGroundTimes];
            nextGroundTimes.splice(Math.max(0, routePointIndex - 1), 1);

            return nextGroundTimes;
        });
    }

    function handleGroundTimeChange(legIndex: number, value: string) {
        const minutes = Math.max(0, Number(value) || 0);

        setGroundTimesMinutes((currentGroundTimes) =>
            currentGroundTimes.map((groundTime, index) =>
                index === legIndex ? minutes : groundTime
            )
        );
    }

    async function handleReject() {
        setIsActionLoading(true);
        setErrorMessage("");

        try {
            await rejectManagementDeparture(parsedDepartureId);
            navigate("/management/orders");
        } catch {
            setErrorMessage("Не удалось отклонить заявку.");
        } finally {
            setIsActionLoading(false);
        }
    }

    async function handleApprove() {
        if (invalidSameAirportLegIndexes.size > 0) {
            setErrorMessage("Соседние аэропорты в маршруте не должны совпадать.");
            return;
        }

        if (routeRequest === null) {
            setErrorMessage("Выберите аэропорт для каждого плеча маршрута.");
            return;
        }

        if (routePreview === null) {
            setErrorMessage("Дождитесь проверки маршрута.");
            return;
        }

        if (!routePreview.canFly) {
            setErrorMessage("В маршруте есть плечо, которое самолёт не может пройти с безопасным запасом.");
            return;
        }

        setIsActionLoading(true);
        setErrorMessage("");

        try {
            await approveManagementDepartureRoute(parsedDepartureId, routeRequest);
            navigate("/management/orders");
        } catch {
            setErrorMessage("Не удалось одобрить заявку с этим маршрутом.");
        } finally {
            setIsActionLoading(false);
        }
    }

    async function handleSaveRoute() {
        if (invalidSameAirportLegIndexes.size > 0) {
            setErrorMessage("Соседние аэропорты в маршруте не должны совпадать.");
            return;
        }

        if (routeRequest === null) {
            setErrorMessage("Выберите аэропорт для каждого плеча маршрута.");
            return;
        }

        if (routePreview === null) {
            setErrorMessage("Дождитесь проверки маршрута.");
            return;
        }

        if (!routePreview.canFly) {
            setErrorMessage("В маршруте есть плечо, которое самолёт не может пройти с безопасным запасом.");
            return;
        }

        setIsActionLoading(true);
        setErrorMessage("");

        try {
            if (mode === "management") {
                await saveManagementDepartureRoute(parsedDepartureId, routeRequest);
            } else {
                await saveUserDepartureRoute(parsedDepartureId, routeRequest);
            }

            const response = mode === "management"
                ? await getManagementDeparture(parsedDepartureId)
                : await getUserDeparture(parsedDepartureId);

            setDeparture(response);
            setRoutePoints(createInitialRoutePoints(response));
            setGroundTimesMinutes(createInitialGroundTimes(response));
            setRoutePreview(null);
        } catch {
            setErrorMessage("Не удалось сохранить маршрут.");
        } finally {
            setIsActionLoading(false);
        }
    }

    function handleResetRoute() {
        if (departure === null) {
            return;
        }

        setRoutePoints(createInitialRoutePoints(departure));
        setGroundTimesMinutes(createInitialGroundTimes(departure));
        setRoutePreview(null);
        setErrorMessage("");
    }

    function handleResetPoint(routePointIndex: number) {
        if (departure === null) {
            return;
        }

        const initialRoutePoints = createInitialRoutePoints(departure);

        if (routePointIndex < initialRoutePoints.length) {
            setRoutePoints((currentRoutePoints) =>
                currentRoutePoints.map((routePoint, index) =>
                    index === routePointIndex
                        ? {
                            ...initialRoutePoints[routePointIndex],
                            key: routePoint.key
                        }
                        : routePoint
                )
            );
            return;
        }

        handleRemovePoint(routePointIndex);
    }

    return (
        <div className="catalog-wrapper">
            <Header showSearch={false}>
                <button
                    className="header-icon-btn"
                    onClick={() => navigate(mode === "management" ? "/management/orders" : "/cabinet")}
                    title="Назад"
                >
                    <svg viewBox="0 0 24 24">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                </button>
            </Header>

            <div className={mode === "client" ? "catalog-layout" : "management-route-standalone"}>
            {mode === "client" && (
                <aside className="catalog-sidebar">
                    <div className="user-brief-info">
                        <span className="user-email-label">
                            {isUserLoading ? "Загрузка..." : user?.email}
                        </span>
                        <a href="/profile" className="profile-redirect-btn">
                            Профиль
                        </a>
                    </div>
                </aside>
            )}

            <main className="catalog-main management-route-page">
                {isLoading ? (
                    <div className="management-empty-state">Загрузка заявки...</div>
                ) : departure === null ? (
                    <div className="management-empty-state">
                        {errorMessage || "Заявка не найдена."}
                    </div>
                ) : (
                    <>
                        <section className="management-route-header">
                            <div>
                                <span className="management-card-label">Заявка #{departure.id}</span>
                                <h1>{departure.planeModelName}</h1>
                                <p>
                                    {buildAirportLabel(
                                        departure.takeOffAirportCity,
                                        departure.takeOffAirportName,
                                        departure.takeOffAirportIata,
                                        departure.takeOffAirportIcao
                                    )} → {buildAirportLabel(
                                        departure.landingAirportCity,
                                        departure.landingAirportName,
                                        departure.landingAirportIata,
                                        departure.landingAirportIcao
                                    )}
                                </p>
                            </div>
                        </section>

                        {errorMessage !== "" && (
                            <div className="management-inline-error">{errorMessage}</div>
                        )}

                        <section className="management-card management-route-section">
                            <div className="management-card-details">
                                <div className="management-order-info-grid">
                                    <InfoCell label="Дата подачи заявки" value={formatOptionalDateTime(departure.createdAt)} />
                                    <InfoCell label="Дата и время вылета" value={formatDateTime(departure.requestedTakeOffDateTime)} />
                                    <InfoCell label="Дата и время прибытия" value={formatDateTime(departure.arrivalDateTime)} />
                                    <InfoCell label="Время в пути" value={formatDuration(summaryFlightTime)} />
                                    <InfoCell label="Расстояние" value={`${formatNumber(summaryDistance)} км`} />
                                    <InfoCell label="Пересадки" value={summaryTransfers.toString()} />
                                </div>

                                <div className="management-route-editor-header">
                                    <h3>Редактирование маршрута</h3>
                                    <div className="management-route-editor-header-actions">
                                        <button
                                            type="button"
                                            className="management-secondary-button management-compact-button"
                                            onClick={handleResetRoute}
                                        >
                                            Сбросить маршрут
                                        </button>
                                        <span>{formatPrice(summaryPrice)}</span>
                                    </div>
                                </div>

                                <div className="management-route-chain">
                                    {routePoints.slice(0, -1).map((routePoint, index) => {
                                        const nextRoutePoint = routePoints[index + 1];
                                        const legPreview = routePreview?.routeLegs[index];
                                        const existingLeg = findExistingRouteLeg(
                                            departure.routeLegs,
                                            routePoint.airportId,
                                            nextRoutePoint.airportId
                                        );
                                        const isLastLeg = index === routePoints.length - 2;

                                        return (
                                            <RouteLegEditorRow
                                                key={`${routePoint.key}-${nextRoutePoint.key}`}
                                                leftPoint={routePoint}
                                                rightPoint={nextRoutePoint}
                                                rightIndex={index + 1}
                                                legIndex={index}
                                                legPreview={legPreview}
                                                existingLeg={existingLeg}
                                                hasSameAirportError={invalidSameAirportLegIndexes.has(index)}
                                                isActive={normalizedActiveCandidatePointIndex === index + 1}
                                                isLastLeg={isLastLeg}
                                                groundTimeMinutes={groundTimesMinutes[index] ?? 90}
                                                onAirportSelect={handleAirportSelect}
                                                onActivatePoint={() => setActiveCandidatePointIndex(index + 1)}
                                                onGroundTimeChange={(value) => handleGroundTimeChange(index, value)}
                                                onAddPoint={() => handleInsertPointBefore(index + 1)}
                                                onRemovePoint={handleRemovePoint}
                                                onResetPoint={handleResetPoint}
                                            />
                                        );
                                    })}
                                </div>

                                <ManagementRouteMap
                                    airports={mapAirports}
                                    candidates={routeCandidates}
                                    mapData={routeMapData}
                                    mapInstance={mapInstance}
                                    onCandidateSelect={handleRouteCandidateSelect}
                                    onMapInstanceChange={setMapInstance}
                                />
                            </div>
                        </section>

                        <section className="management-card management-route-section">
                            <div className="management-card-details">
                                <div className="management-passenger-section-header">
                                    <h3>Пассажиры</h3>
                                    <span>
                                        {departure.passengerCount} из {departure.planePassengerCapacity}
                                    </span>
                                </div>

                                {departure.passengers.length === 0 ? (
                                    <p className="management-muted-text">Пассажиры не указаны.</p>
                                ) : (
                                    <div className="management-passenger-list">
                                        {departure.passengers.map((passenger) => (
                                            <div key={passenger.id} className="management-passenger-row">
                                                <span>{passenger.fullName}</span>
                                                <span>{passenger.email || "Почта не указана"}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </section>

                        <div className="management-route-actions">
                            {mode === "management" && (
                            <button
                                type="button"
                                className="management-danger-button"
                                onClick={handleReject}
                                disabled={isActionLoading || !departure.canApprove}
                            >
                                Отклонить
                            </button>
                            )}

                            <button
                                type="button"
                                className="management-secondary-button"
                                onClick={handleSaveRoute}
                                disabled={
                                    isActionLoading ||
                                    !departure.canEditRoute ||
                                    routeRequest === null ||
                                    routePreview?.canFly !== true
                                }
                            >
                                Сохранить
                            </button>

                            {mode === "management" && (
                            <button
                                type="button"
                                className="management-primary-button"
                                onClick={handleApprove}
                                disabled={
                                    isActionLoading ||
                                    !departure.canApprove ||
                                    routeRequest === null ||
                                    routePreview?.canFly !== true
                                }
                            >
                                Одобрить
                            </button>
                            )}
                        </div>
                    </>
                )}
            </main>
            </div>
        </div>
    );
}

function RouteLegEditorRow({
    leftPoint,
    rightPoint,
    rightIndex,
    legIndex,
    legPreview,
    existingLeg,
    hasSameAirportError,
    isActive,
    isLastLeg,
    groundTimeMinutes,
    onAirportSelect,
    onActivatePoint,
    onGroundTimeChange,
    onAddPoint,
    onRemovePoint,
    onResetPoint
}: {
    leftPoint: RoutePoint;
    rightPoint: RoutePoint;
    rightIndex: number;
    legIndex: number;
    legPreview?: ManagementRoutePreviewLegResponse;
    existingLeg?: ManagementRouteLegResponse;
    hasSameAirportError: boolean;
    isActive: boolean;
    isLastLeg: boolean;
    groundTimeMinutes: number;
    onAirportSelect: (
        routePointIndex: number,
        airportId: string,
        displayName: string,
        airport: AirportSearchResponse
    ) => void;
    onActivatePoint: () => void;
    onGroundTimeChange: (value: string) => void;
    onAddPoint: () => void;
    onRemovePoint: (routePointIndex: number) => void;
    onResetPoint: (routePointIndex: number) => void;
}) {
    const displayLeg = legPreview ?? existingLeg;
    const isInvalid = hasSameAirportError || legPreview?.canFly === false;

    return (
        <div className="management-route-chain-item">
            <div className={`management-route-chain-row ${isActive ? "active" : ""}`}>
                <LockedAirportCard
                    point={leftPoint}
                />

                {isLastLeg ? (
                    <div className="management-route-airport-locked-actions">
                        <LockedAirportCard
                            point={rightPoint}
                            invalid={isInvalid}
                        />

                        <button
                            type="button"
                            className="management-route-icon-button"
                            onClick={onAddPoint}
                            title="Добавить аэропорт"
                        >
                            +
                        </button>
                    </div>
                ) : (
                    <EditableAirportField
                        point={rightPoint}
                        pointIndex={rightIndex}
                        invalid={isInvalid}
                        onAirportSelect={onAirportSelect}
                        onActivatePoint={onActivatePoint}
                        onAddPoint={onAddPoint}
                        onRemovePoint={onRemovePoint}
                        onResetPoint={onResetPoint}
                    />
                )}
            </div>

            <div className="management-route-leg-footer">
                {hasSameAirportError ? (
                    <span className="management-route-leg-summary invalid">
                        Соседние аэропорты совпадают
                    </span>
                ) : displayLeg ? (
                    <span className="management-route-leg-summary-block">
                        <span className={`management-route-leg-summary ${isInvalid ? "invalid" : ""}`}>
                            Перелёт: {formatNumber(displayLeg.distanceKm)} км • {formatDuration(displayLeg.flightTime)} • {formatPrice(displayLeg.flightCost)}
                        </span>

                        {legPreview?.canFly === false && (
                            <span className="management-route-leg-error">
                                Превышена безопасная дальность самолёта: максимум {formatNumber(legPreview.maximumLegDistanceKm)} км
                            </span>
                        )}
                    </span>
                ) : (
                    <span className="management-route-leg-summary muted">Перелёт {legIndex + 1}</span>
                )}

                {!isLastLeg && (
                    <label className="management-ground-time-inline">
                        <span>Стоянка, мин</span>
                        <input
                            type="number"
                            min="0"
                            max="1440"
                            value={groundTimeMinutes}
                            onChange={(event) => onGroundTimeChange(event.target.value)}
                        />
                    </label>
                )}
            </div>
        </div>
    );
}

function LockedAirportCard({
    point,
    invalid = false
}: {
    point: RoutePoint;
    invalid?: boolean;
}) {
    return (
        <div className={`management-route-airport-card ${invalid ? "invalid" : ""}`}>
            <strong>{point.displayName}</strong>
        </div>
    );
}

function EditableAirportField({
    point,
    pointIndex,
    invalid,
    onAirportSelect,
    onActivatePoint,
    onAddPoint,
    onRemovePoint,
    onResetPoint
}: {
    point: RoutePoint;
    pointIndex: number;
    invalid: boolean;
    onAirportSelect: (
        routePointIndex: number,
        airportId: string,
        displayName: string,
        airport: AirportSearchResponse
    ) => void;
    onActivatePoint: () => void;
    onAddPoint: () => void;
    onRemovePoint: (routePointIndex: number) => void;
    onResetPoint: (routePointIndex: number) => void;
}) {
    return (
        <div
            className={`management-route-airport-editable ${invalid ? "invalid" : ""}`}
            onClick={onActivatePoint}
            onFocusCapture={onActivatePoint}
        >
            <AirportSearch
                label=""
                selectedAirportId={point.airportId?.toString() ?? ""}
                selectedAirportDisplayName={point.displayName}
                onSelect={(airport) =>
                    onAirportSelect(pointIndex, airport.id, airport.displayName, airport.airport)
                }
            />

            <button
                type="button"
                className="management-route-reset-point"
                onClick={() => onResetPoint(pointIndex)}
                title="Сбросить аэропорт"
            >
                ↺
            </button>

            <button
                type="button"
                className="management-route-icon-button"
                onClick={onAddPoint}
                title="Добавить аэропорт"
            >
                +
            </button>

            <button
                type="button"
                className="management-route-remove-point"
                onClick={() => onRemovePoint(pointIndex)}
                title="Удалить аэропорт"
            >
                −
            </button>
        </div>
    );
}

function ManagementRouteMap({
    airports,
    candidates,
    mapData,
    mapInstance,
    onCandidateSelect,
    onMapInstanceChange
}: {
    airports: Array<ManagementRouteAirportResponse | AirportSearchResponse>;
    candidates: ManagementRouteCandidateResponse[];
    mapData: ReturnType<typeof createRouteMapData>;
    mapInstance: YandexMapInstance | null;
    onCandidateSelect: (candidate: ManagementRouteCandidateResponse) => void;
    onMapInstanceChange: (mapInstance: YandexMapInstance | null) => void;
}) {
    const yandexMapsApiKey = import.meta.env.VITE_YANDEX_MAPS_API_KEY as string | undefined;

    if (airports.length < 2) {
        return null;
    }

    const mapDefaultState = mapData.bounds !== undefined
        ? { bounds: mapData.bounds }
        : { center: defaultMapCenter, zoom: 3 };

    return (
        <div className="management-route-map">
            {!yandexMapsApiKey ? (
                <div className="management-route-map-message">
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
                        key={mapData.key}
                        width="100%"
                        height="100%"
                        defaultState={mapDefaultState}
                        modules={[
                            "geoObject.addon.hint",
                            "geoObject.addon.balloon"
                        ]}
                        instanceRef={(instance) => {
                            const nextMapInstance = instance as YandexMapInstance | null;

                            if (nextMapInstance !== mapInstance) {
                                onMapInstanceChange(nextMapInstance);
                            }
                        }}
                    >
                        {mapData.polylines.map((polyline) => (
                            <Polyline
                                key={polyline.key}
                                geometry={polyline.geometry}
                                properties={{
                                    hintContent: polyline.title
                                }}
                                options={{
                                    strokeColor: polyline.canFly ? "#2563eb" : "#ff4d4f",
                                    strokeWidth: 5,
                                    strokeOpacity: 0.85
                                }}
                            />
                        ))}

                        {airports.map((airport, index) => (
                            <Placemark
                                key={`${airport.id}-${index}`}
                                geometry={[airport.latitude, airport.longitude]}
                                properties={{
                                    hintContent: getAirportDisplayName(airport)
                                }}
                                options={{
                                    preset: index === 0
                                        ? "islands#greenCircleDotIcon"
                                        : index === airports.length - 1
                                            ? "islands#redCircleDotIcon"
                                            : "islands#blueCircleDotIcon"
                                }}
                            />
                        ))}

                        {candidates.map((candidate) => (
                            <Placemark
                                key={`candidate-${candidate.id}-${candidate.isBestSystemChoice ? "best" : "regular"}`}
                                geometry={[candidate.latitude, candidate.longitude]}
                                properties={{
                                    hintContent: createCandidateHint(candidate),
                                    balloonContent: createCandidateHint(candidate)
                                }}
                                options={{
                                    preset: getCandidatePlacemarkPreset(candidate)
                                }}
                                onClick={() => onCandidateSelect(candidate)}
                            />
                        ))}
                    </Map>
                </YMaps>
            )}
        </div>
    );
}

function InfoCell({ label, value }: { label: string; value: string }) {
    return (
        <div className="management-info-block">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

const defaultMapCenter: Coordinate = [55.751244, 37.618423];

function getActiveCandidatePointIndex(
    routePoints: RoutePoint[],
    activeCandidatePointIndex: number | null
): number | null {
    if (routePoints.length < 3) {
        return null;
    }

    if (
        activeCandidatePointIndex !== null &&
        activeCandidatePointIndex > 0 &&
        activeCandidatePointIndex < routePoints.length - 1
    ) {
        return activeCandidatePointIndex;
    }

    return 1;
}

function createMapAirportsFromRoutePoints(
    routePoints: RoutePoint[],
    routePreview: ManagementRoutePreviewResponse | null,
    existingRouteAirports: ManagementRouteAirportResponse[]
): Array<ManagementRouteAirportResponse | AirportSearchResponse> {
    const previewAirportById = new globalThis.Map(
        routePreview?.routeAirports.map((airport) => [airport.id, airport]) ?? []
    );
    const existingAirportById = new globalThis.Map(
        existingRouteAirports.map((airport) => [airport.id, airport])
    );

    return routePoints
        .map((routePoint) => {
            if (routePoint.airport && hasAirportCoordinates(routePoint.airport)) {
                return routePoint.airport;
            }

            if (routePoint.airportId === null) {
                return undefined;
            }

            return previewAirportById.get(routePoint.airportId) ??
                existingAirportById.get(routePoint.airportId);
        })
        .filter((airport): airport is ManagementRouteAirportResponse | AirportSearchResponse =>
            airport !== undefined && hasAirportCoordinates(airport)
        );
}

function hasAirportCoordinates(airport: ManagementRouteAirportResponse | AirportSearchResponse): boolean {
    return Number.isFinite(airport.latitude) && Number.isFinite(airport.longitude);
}

function createMapLegsFromRoutePoints(
    routePoints: RoutePoint[],
    routePreview: ManagementRoutePreviewResponse | null,
    existingRouteLegs: ManagementRouteLegResponse[]
): MapRouteLeg[] {
    const mapLegs: MapRouteLeg[] = [];

    for (let index = 0; index < routePoints.length - 1; index++) {
        const fromAirportId = routePoints[index].airportId;
        const toAirportId = routePoints[index + 1].airportId;

        if (fromAirportId === null || toAirportId === null) {
            continue;
        }

        const previewLeg = routePreview?.routeLegs[index];

        if (
            previewLeg &&
            previewLeg.fromAirportId === fromAirportId &&
            previewLeg.toAirportId === toAirportId
        ) {
            mapLegs.push({
                fromAirportId,
                toAirportId,
                distanceKm: previewLeg.distanceKm,
                canFly: previewLeg.canFly
            });
            continue;
        }

        const existingLeg = findExistingRouteLeg(existingRouteLegs, fromAirportId, toAirportId);

        mapLegs.push({
            fromAirportId,
            toAirportId,
            distanceKm: existingLeg?.distanceKm ?? 0,
            canFly: fromAirportId !== toAirportId
        });
    }

    return mapLegs;
}

function createRouteMapData(
    airports: Array<ManagementRouteAirportResponse | AirportSearchResponse>,
    legs: MapRouteLeg[],
    candidates: ManagementRouteCandidateResponse[]
) {
    const airportById = new globalThis.Map(airports.map((airport) => [airport.id, airport]));
    const polylines = legs
        .map((leg, index) => {
            const fromAirport = airportById.get(leg.fromAirportId);
            const toAirport = airportById.get(leg.toAirportId);

            if (!fromAirport || !toAirport) {
                return null;
            }

            const geometry = getGreatCircleArcCoordinates(
                fromAirport,
                toAirport,
                getArcSegmentCount(leg.distanceKm)
            );

            return {
                key: `${leg.fromAirportId}-${leg.toAirportId}-${index}`,
                geometry,
                canFly: leg.canFly,
                title: `${getAirportDisplayName(fromAirport)} - ${getAirportDisplayName(toAirport)}`
            };
        })
        .filter((polyline): polyline is {
            key: string;
            geometry: Coordinate[];
            canFly: boolean;
            title: string;
        } => polyline !== null);

    const coordinates = [
        ...airports.map((airport): Coordinate => [airport.latitude, airport.longitude]),
        ...candidates.map((candidate): Coordinate => [candidate.latitude, candidate.longitude]),
        ...polylines.flatMap((polyline) => polyline.geometry)
    ];

    return {
        key: [
            airports.map((airport) => airport.id).join("-"),
            candidates.map((candidate) =>
                `${candidate.id}-${candidate.isBestSystemChoice ? "best" : candidate.priorityScore}`
            ).join("-"),
            legs.map((leg) =>
                `${leg.fromAirportId}-${leg.toAirportId}-${leg.canFly ? "ok" : "bad"}`
            ).join("-")
        ].join("|"),
        polylines,
        bounds: getMapBounds(coordinates)
    };
}

function getAirportDisplayName(
    airport: ManagementRouteAirportResponse | AirportSearchResponse | ManagementRouteCandidateResponse
): string {
    return buildAirportLabel(airport.city, airport.name, airport.iata, airport.icao);
}

function getCandidatePlacemarkPreset(candidate: ManagementRouteCandidateResponse): string {
    if (candidate.isBestSystemChoice) {
        return "islands#yellowStarIcon";
    }

    if (candidate.isCapital) {
        return "islands#violetCircleDotIcon";
    }

    if (candidate.isLargeCity || candidate.priorityScore > 0) {
        return "islands#darkBlueCircleDotIcon";
    }

    return "islands#grayCircleDotIcon";
}

function createCandidateHint(candidate: ManagementRouteCandidateResponse): string {
    const labels = [
        candidate.isBestSystemChoice ? "лучший системный вариант" : "",
        candidate.isCapital ? "столица" : "",
        candidate.isLargeCity ? "крупный город" : ""
    ].filter(Boolean);

    const suffix = labels.length > 0
        ? ` — ${labels.join(", ")}`
        : "";

    return `${getAirportDisplayName(candidate)}${suffix}. ${formatNumber(candidate.distanceFromCurrentKm)} км от текущего аэропорта`;
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

function getArcSegmentCount(distanceKm: number): number {
    return Math.max(8, Math.min(80, Math.ceil(distanceKm / 180)));
}

function getGreatCircleArcCoordinates(
    fromAirport: ManagementRouteAirportResponse | AirportSearchResponse,
    toAirport: ManagementRouteAirportResponse | AirportSearchResponse,
    segmentCount: number
): Coordinate[] {
    if (fromAirport.id === toAirport.id) {
        return [
            [fromAirport.latitude, fromAirport.longitude],
            [toAirport.latitude, toAirport.longitude]
        ];
    }

    const coordinates: Coordinate[] = [];

    for (let index = 0; index <= segmentCount; index++) {
        const ratio = index / segmentCount;

        coordinates.push([
            fromAirport.latitude + (toAirport.latitude - fromAirport.latitude) * ratio,
            fromAirport.longitude + (toAirport.longitude - fromAirport.longitude) * ratio
        ]);
    }

    return coordinates;
}

function createRouteRequest(
    routePoints: RoutePoint[],
    groundTimesMinutes: Array<number | null>
): UpdateDepartureRouteRequest {
    return {
        airportIds: routePoints.map((routePoint) => routePoint.airportId!),
        groundTimesAfterArrival: routePoints.slice(0, -1).map((_, index) =>
            index === routePoints.length - 2
                ? null
                : minutesToTimeSpan(groundTimesMinutes[index] ?? 90)
        )
    };
}

function createSameAirportLegIndexSet(routePoints: RoutePoint[]): Set<number> {
    const sameAirportLegIndexes = new Set<number>();

    for (let routePointIndex = 0; routePointIndex < routePoints.length - 1; routePointIndex++) {
        const fromAirportId = routePoints[routePointIndex].airportId;
        const toAirportId = routePoints[routePointIndex + 1].airportId;

        if (fromAirportId !== null && fromAirportId === toAirportId) {
            sameAirportLegIndexes.add(routePointIndex);
        }
    }

    return sameAirportLegIndexes;
}

function findExistingRouteLeg(
    routeLegs: ManagementRouteLegResponse[],
    fromAirportId: number | null,
    toAirportId: number | null
): ManagementRouteLegResponse | undefined {
    if (fromAirportId === null || toAirportId === null) {
        return undefined;
    }

    return routeLegs.find((routeLeg) =>
        routeLeg.fromAirportId === fromAirportId &&
        routeLeg.toAirportId === toAirportId
    );
}

function createInitialRoutePoints(departure: ManagementDepartureResponse): RoutePoint[] {
    const routeAirports = departure.routeAirports.length > 0
        ? departure.routeAirports
        : [
            {
                id: departure.takeOffAirportId,
                name: departure.takeOffAirportName,
                city: departure.takeOffAirportCity,
                country: "",
                iata: departure.takeOffAirportIata,
                icao: departure.takeOffAirportIcao,
                latitude: 0,
                longitude: 0
            },
            {
                id: departure.landingAirportId,
                name: departure.landingAirportName,
                city: departure.landingAirportCity,
                country: "",
                iata: departure.landingAirportIata,
                icao: departure.landingAirportIcao,
                latitude: 0,
                longitude: 0
            }
        ];

    return routeAirports.map((airport, index) => ({
        key: `${airport.id}-${index}`,
        airportId: airport.id,
        displayName: buildAirportLabel(airport.city, airport.name, airport.iata, airport.icao),
        airport
    }));
}

function createInitialGroundTimes(departure: ManagementDepartureResponse): Array<number | null> {
    if (departure.routeLegs.length === 0) {
        return [null];
    }

    return departure.routeLegs.map((routeLeg, index) =>
        index === departure.routeLegs.length - 1
            ? null
            : timeSpanToMinutes(routeLeg.groundTimeAfterArrival) ?? 90
    );
}

function timeSpanToMinutes(value?: string | null): number | null {
    if (!value) {
        return null;
    }

    const match = value.match(/(?:(\d+)\.)?(\d+):(\d+)(?::(\d+))?/);

    if (!match) {
        return null;
    }

    const days = match[1] ? Number(match[1]) : 0;
    const hours = Number(match[2]) + days * 24;
    const minutes = Number(match[3]);

    return hours * 60 + minutes;
}

function minutesToTimeSpan(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00`;
}
