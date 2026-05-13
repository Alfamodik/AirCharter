import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { YMaps, Map, Placemark, Polyline } from "@pbe/react-yandex-maps";
import Header from "../../components/header/Header";
import AirportSearch from "../../components/airportSearch/AirportSearch";
import {
    approveManagementDeparture,
    approveManagementDepartureRoute,
    confirmManagementDepartureContractDocument,
    deleteLatestManagementDepartureStatus,
    getManagementDeparture,
    getManagementRouteCandidates,
    previewManagementDepartureRoute,
    rejectManagementDeparture,
    saveManagementDepartureRoute,
    updateManagementDepartureEmployees,
    updateManagementDepartureTakeOffDateTime,
    updateManagementDepartureStatus,
    type ManagementRouteCandidateResponse,
    type ManagementRoutePreviewLegResponse,
    type ManagementRoutePreviewResponse,
    type UpdateDepartureRouteRequest
} from "../../api/managementService";
import { hasManagementAccess } from "../../api/utils/roleAccess";
import {
    addUserDeparturePassenger,
    deleteUserDeparture,
    getUserDeparture,
    getUserRouteCandidates,
    previewUserDepartureRoute,
    removeUserDeparturePassenger,
    saveUserDepartureRoute,
    submitUserDeparture,
    updateUserDepartureTakeOffDateTime,
    downloadDepartureContract,
    downloadDepartureContractDocument,
    uploadDepartureContractDocument,
    payUserDeparture,
    downloadUserDepartureTicket
} from "../../api/userService";
import { getMyAirlineEmployees, type AirlineEmployeeResponse } from "../../api/airlineService";
import {
    createPassenger,
    getPassengerEditDetails,
    searchPassengers,
    updatePassengerByPassport,
    type PersonEditResponse,
    type PassengerSearchResponse
} from "../../api/personService";
import { useUser } from "../../context/UserContext";
import InputField from "../../components/inputField/InputField";
import type { ProfileFormData } from "../../contracts/responses/persons/profileFormData";
import type {
    ManagementDepartureResponse,
    ManagementPassengerResponse,
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

type ActiveRouteChoice = {
    leftPoint: RoutePoint;
    rightPoint: RoutePoint;
    rightPointIndex: number;
    segmentNumber: number;
    segmentCount: number;
    canEditRightPoint: boolean;
    canRemoveRightPoint: boolean;
};

type ManagementOrderRoutePageProps = {
    mode?: "management" | "client";
};

type DepartureSectionKey = "operations" | "passengers" | "employees" | "route" | "history";

type PendingManagementStatusChange = {
    statusId: number;
    includePreviousStatuses: boolean;
    targetLegIndex?: number | null;
};

const emptyPassengerForm: ProfileFormData = {
    firstName: "",
    lastName: "",
    patronymic: "",
    passportSeries: "",
    passportNumber: "",
    email: "",
    birthDate: "",
    registrationAddress: "",
    actualAddress: "",
    phoneNumber: "",
    taxpayerId: "",
    bankName: "",
    currentAccountNumber: "",
    correspondentAccountNumber: "",
    bankIdentifierCode: ""
};

export default function ManagementOrderRoutePage({
    mode = "management"
}: ManagementOrderRoutePageProps) {
    const navigate = useNavigate();
    const location = useLocation();
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
    const [isPassengerActionLoading, setIsPassengerActionLoading] = useState(false);
    const [isPassengerModalOpen, setIsPassengerModalOpen] = useState(false);
    const [editingPassenger, setEditingPassenger] = useState<ManagementPassengerResponse | null>(null);
    const [passengerForm, setPassengerForm] = useState<ProfileFormData>(emptyPassengerForm);
    const [pendingPassengers, setPendingPassengers] = useState<ManagementPassengerResponse[]>([]);
    const [availableEmployees, setAvailableEmployees] = useState<AirlineEmployeeResponse[]>([]);
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
    const [errorMessage, setErrorMessage] = useState("");
    const [requestedTakeOffInput, setRequestedTakeOffInput] = useState("");
    const [mapInstance, setMapInstance] = useState<YandexMapInstance | null>(null);
    const contractFileInputRef = useRef<HTMLInputElement | null>(null);
    const [routeChooserElement, setRouteChooserElement] = useState<HTMLDivElement | null>(null);
    const [expandedSections, setExpandedSections] = useState<Set<DepartureSectionKey>>(() => new Set(["operations"]));
    const [pendingCompletionStatus, setPendingCompletionStatus] = useState<PendingManagementStatusChange | null>(null);
    const [isDeleteDepartureConfirmOpen, setIsDeleteDepartureConfirmOpen] = useState(false);
    const isFlightManagementPage = mode === "management" && location.pathname.includes("/management/flights/");

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
    const visibleRouteCandidates = useMemo(() => {
        return departure?.canEditRoute === true ? routeCandidates : [];
    }, [departure?.canEditRoute, routeCandidates]);
    const hasRouteChanges = departure !== null &&
        hasUnsavedRouteChanges(departure, routePoints, groundTimesMinutes);
    const hasTakeOffDateTimeChanges = departure !== null &&
        requestedTakeOffInput.trim() !== "" &&
        requestedTakeOffInput !== formatDateTimeLocalInput(departure.requestedTakeOffDateTime);
    const shouldValidateRequestedTakeOffDateTime = departure !== null &&
        !isFlightManagementPage &&
        (departure.currentStatusId === 1 || departure.currentStatusId === 2);
    const isRequestedTakeOffTooEarly = shouldValidateRequestedTakeOffDateTime &&
        requestedTakeOffInput.trim() !== "" &&
        requestedTakeOffInput < getTomorrowStartDateTimeLocalInput();
    const requestedTakeOffDateTimeError = isRequestedTakeOffTooEarly
        ? "Дата и время вылета должны быть не раньше завтрашнего дня."
        : "";
    const passengerIdsToAdd = useMemo(() => {
        if (departure === null || mode !== "client") {
            return [];
        }

        const savedPassengerIds = new Set(departure.passengers.map((passenger) => passenger.id));
        return pendingPassengers
            .map((passenger) => passenger.id)
            .filter((passengerId) => !savedPassengerIds.has(passengerId));
    }, [departure, mode, pendingPassengers]);
    const passengerIdsToRemove = useMemo(() => {
        if (departure === null || mode !== "client") {
            return [];
        }

        const pendingPassengerIds = new Set(pendingPassengers.map((passenger) => passenger.id));
        return departure.passengers
            .map((passenger) => passenger.id)
            .filter((passengerId) => !pendingPassengerIds.has(passengerId));
    }, [departure, mode, pendingPassengers]);
    const hasPassengerChanges = passengerIdsToAdd.length > 0 || passengerIdsToRemove.length > 0;
    const hasUnsavedDepartureChanges = hasRouteChanges || hasTakeOffDateTimeChanges || hasPassengerChanges;
    const unsavedDepartureChangesMessage = hasUnsavedDepartureChanges
        ? "Есть несохраненные изменения. Нажмите «Сохранить», чтобы применить их."
        : "";
    const canDownloadContractTemplate = departure !== null &&
        (
            departure.canEditRoute ||
            departure.currentStatusId === 19
        );
    const canUploadContractDocument = departure !== null &&
        departure.currentStatusId === 19 &&
        (
            mode === "management" ||
            (mode === "client" && !departure.contractDocumentUploadedByAirline)
        );
    const canSaveDepartureChanges = departure !== null &&
        departure.canEditRoute &&
        hasUnsavedDepartureChanges;
    const canDeleteDeparture = departure !== null &&
        mode === "client" &&
        (departure.canDelete || departure.currentStatusId === 1 || departure.currentStatusId === 2);
    const canApproveDeparture = departure !== null &&
        mode === "management" &&
        departure.canApprove &&
        !isRequestedTakeOffTooEarly &&
        (
            !hasRouteChanges ||
            (
                routeRequest !== null &&
                routePreview?.canFly === true
            )
        );

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
                setPendingPassengers(response.passengers);
                setSelectedEmployeeIds(response.employees.map((employee) => employee.id));
                setRequestedTakeOffInput(formatDateTimeLocalInput(response.requestedTakeOffDateTime));
                setRoutePoints(createInitialRoutePoints(response));
                setGroundTimesMinutes(createInitialGroundTimes(response));
            } catch (error: unknown) {
                if (!abortController.signal.aborted) {
                    if (getApiStatus(error) === 404) {
                        navigate(getBackTarget(location.state, location.pathname, mode), { replace: true });
                        return;
                    }

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
        if (
            isUserLoading ||
            user === null ||
            mode !== "management" ||
            !hasManagementAccess(user.role?.name)
        ) {
            return;
        }

        const abortController = new AbortController();

        async function loadEmployees() {
            try {
                const response = await getMyAirlineEmployees(parsedDepartureId, abortController.signal);
                setAvailableEmployees(response);
            } catch {
                if (!abortController.signal.aborted) {
                    setAvailableEmployees([]);
                }
            }
        }

        loadEmployees();

        return () => abortController.abort();
    }, [isUserLoading, mode, parsedDepartureId, user]);

    useEffect(() => {
        if (routeRequest === null || !hasRouteChanges || Number.isNaN(parsedDepartureId)) {
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
    }, [hasRouteChanges, mode, parsedDepartureId, routeRequest]);

    useEffect(() => {
        if (
            departure === null ||
            !departure.canEditRoute ||
            normalizedActiveCandidatePointIndex === null ||
            normalizedActiveCandidatePointIndex >= routePoints.length - 1 ||
            Number.isNaN(parsedDepartureId)
        ) {
            setRouteCandidates([]);
            return;
        }

        const fromAirportId = routePoints[normalizedActiveCandidatePointIndex - 1]?.airportId;
        const toAirportId = routePoints[normalizedActiveCandidatePointIndex]?.airportId ??
            routePoints[normalizedActiveCandidatePointIndex + 1]?.airportId ??
            null;

        if (fromAirportId === null || fromAirportId === undefined) {
            setRouteCandidates([]);
            return;
        }

        const currentFromAirportId = fromAirportId;
        const abortController = new AbortController();

        async function loadRouteCandidates() {
            try {
                const response = mode === "management"
                    ? await getManagementRouteCandidates(
                        parsedDepartureId,
                        currentFromAirportId,
                        toAirportId,
                        abortController.signal
                    )
                    : await getUserRouteCandidates(
                        parsedDepartureId,
                        currentFromAirportId,
                        toAirportId,
                        abortController.signal
                    );

                const routeAirportIds = new Set(
                    routePoints
                        .map((routePoint) => routePoint.airportId)
                        .filter((airportId): airportId is number => airportId !== null)
                );

                setRouteCandidates(
                    response.filter((candidate) => !routeAirportIds.has(candidate.id))
                );
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
        return createRouteMapData(mapAirports, mapLegs, visibleRouteCandidates);
    }, [mapAirports, mapLegs, visibleRouteCandidates]);

    useEffect(() => {
        if (mapInstance === null || routeMapData.bounds === undefined) {
            return;
        }

        mapInstance.setBounds(routeMapData.bounds, {
            checkZoomRange: true,
            zoomMargin: [55, 55, 55, 55]
        });
    }, [mapInstance, routeMapData.bounds]);

    const activeRouteChoice = useMemo(() => {
        return createActiveRouteChoice(routePoints, normalizedActiveCandidatePointIndex);
    }, [normalizedActiveCandidatePointIndex, routePoints]);

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
        if (
            normalizedActiveCandidatePointIndex === null ||
            activeRouteChoice?.canEditRightPoint !== true
        ) {
            return;
        }

        handleAirportSelect(
            normalizedActiveCandidatePointIndex,
            candidate.id.toString(),
            getAirportDisplayName(candidate),
            candidate
        );
    }

    function handleCandidateSegmentChange(direction: -1 | 1) {
        if (routePoints.length < 2) {
            return;
        }

        const currentIndex = normalizedActiveCandidatePointIndex ?? 1;
        const nextIndex = Math.min(
            Math.max(currentIndex + direction, 1),
            routePoints.length - 1
        );

        setActiveCandidatePointIndex(nextIndex);
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
            window.setTimeout(() => {
                routeChooserElement?.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });
            }, 0);

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

    async function handleDeleteDeparture() {
        if (!canDeleteDeparture || departure === null) {
            return;
        }

        setIsActionLoading(true);
        setErrorMessage("");

        try {
            await deleteUserDeparture(departure.id);
            navigate("/cabinet");
        } catch (error: unknown) {
            setErrorMessage(getApiErrorMessage(
                error,
                "Не удалось удалить заявку. Удаление доступно только для статусов создания и ожидания одобрения."
            ));
        } finally {
            setIsActionLoading(false);
            setIsDeleteDepartureConfirmOpen(false);
        }
    }

    async function handleApprove() {
        if (departure === null || mode !== "management" || !departure.canApprove) {
            return;
        }

        if (isRequestedTakeOffTooEarly) {
            setErrorMessage("Дата и время вылета должны быть не раньше завтрашнего дня.");
            return;
        }

        if (!hasRouteChanges) {
            setIsActionLoading(true);
            setErrorMessage("");

            try {
                if (hasTakeOffDateTimeChanges) {
                    await updateManagementDepartureTakeOffDateTime(parsedDepartureId, `${requestedTakeOffInput}:00`);
                }

                await approveManagementDeparture(parsedDepartureId);
                navigate("/management/orders");
            } catch {
                setErrorMessage("Не удалось одобрить заявку.");
            } finally {
                setIsActionLoading(false);
            }

            return;
        }

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
            if (hasTakeOffDateTimeChanges) {
                await updateManagementDepartureTakeOffDateTime(parsedDepartureId, `${requestedTakeOffInput}:00`);
            }

            await approveManagementDepartureRoute(parsedDepartureId, routeRequest);
            navigate("/management/orders");
        } catch {
            setErrorMessage("Не удалось одобрить заявку с этим маршрутом.");
        } finally {
            setIsActionLoading(false);
        }
    }

    async function handleSaveRoute() {
        if (!hasUnsavedDepartureChanges) {
            return;
        }

        if (isRequestedTakeOffTooEarly) {
            setErrorMessage("Дата и время вылета должны быть не раньше завтрашнего дня.");
            return;
        }

        if (hasRouteChanges && invalidSameAirportLegIndexes.size > 0) {
            setErrorMessage("Соседние аэропорты в маршруте не должны совпадать.");
            return;
        }

        if (hasRouteChanges && routeRequest === null) {
            setErrorMessage("Выберите аэропорт для каждого плеча маршрута.");
            return;
        }

        if (hasRouteChanges && routePreview === null) {
            setErrorMessage("Дождитесь проверки маршрута.");
            return;
        }

        if (hasRouteChanges && !routePreview?.canFly) {
            setErrorMessage("В маршруте есть плечо, которое самолёт не может пройти с безопасным запасом.");
            return;
        }

        setIsActionLoading(true);
        setErrorMessage("");

        try {
            if (hasRouteChanges && routeRequest !== null) {
                if (mode === "management") {
                    await saveManagementDepartureRoute(parsedDepartureId, routeRequest);
                } else {
                    await saveUserDepartureRoute(parsedDepartureId, routeRequest);
                }
            }

            if (hasTakeOffDateTimeChanges) {
                if (mode === "management") {
                    await updateManagementDepartureTakeOffDateTime(parsedDepartureId, `${requestedTakeOffInput}:00`);
                } else {
                    await updateUserDepartureTakeOffDateTime(parsedDepartureId, `${requestedTakeOffInput}:00`);
                }
            }

            if (mode === "client" && hasPassengerChanges) {
                for (const passengerId of passengerIdsToRemove) {
                    await removeUserDeparturePassenger(parsedDepartureId, passengerId);
                }

                for (const passengerId of passengerIdsToAdd) {
                    await addUserDeparturePassenger(parsedDepartureId, passengerId);
                }
            }

            const response = mode === "management"
                ? await getManagementDeparture(parsedDepartureId)
                : await getUserDeparture(parsedDepartureId);

            setDeparture(response);
            setPendingPassengers(response.passengers);
            setSelectedEmployeeIds(response.employees.map((employee) => employee.id));
            setRequestedTakeOffInput(formatDateTimeLocalInput(response.requestedTakeOffDateTime));
            setRoutePoints(createInitialRoutePoints(response));
            setGroundTimesMinutes(createInitialGroundTimes(response));
            setRoutePreview(null);
            if (hasRouteChanges) {
                navigate(mode === "management" ? "/management/orders" : "/cabinet");
            }
        } catch {
            setErrorMessage("Не удалось сохранить изменения заявки.");
        } finally {
            setIsActionLoading(false);
        }
    }

    async function handleSubmitApplication() {
        if (departure === null) {
            return;
        }

        if (pendingPassengers.length <= 0) {
            setErrorMessage("Добавьте хотя бы одного пассажира перед отправкой заявки.");
            return;
        }

        if (isRequestedTakeOffTooEarly) {
            setErrorMessage("Дата и время вылета должны быть не раньше завтрашнего дня.");
            return;
        }

        if (invalidSameAirportLegIndexes.size > 0) {
            setErrorMessage("Соседние аэропорты в маршруте не должны совпадать.");
            return;
        }

        if (routeRequest === null) {
            setErrorMessage("Выберите аэропорт для каждого плеча маршрута.");
            return;
        }

        if (hasRouteChanges && routePreview === null) {
            setErrorMessage("Дождитесь проверки маршрута.");
            return;
        }

        if (hasRouteChanges && !routePreview?.canFly) {
            setErrorMessage("В маршруте есть плечо, которое самолёт не может пройти с безопасным запасом.");
            return;
        }

        setIsActionLoading(true);
        setErrorMessage("");

        try {
            if (hasRouteChanges) {
                await saveUserDepartureRoute(departure.id, routeRequest);
            }

            if (hasTakeOffDateTimeChanges) {
                await updateUserDepartureTakeOffDateTime(departure.id, `${requestedTakeOffInput}:00`);
            }

            if (hasPassengerChanges) {
                for (const passengerId of passengerIdsToRemove) {
                    await removeUserDeparturePassenger(departure.id, passengerId);
                }

                for (const passengerId of passengerIdsToAdd) {
                    await addUserDeparturePassenger(departure.id, passengerId);
                }
            }

            await submitUserDeparture(departure.id);

            const response = await getUserDeparture(departure.id);
            setDeparture(response);
            setPendingPassengers(response.passengers);
            setSelectedEmployeeIds(response.employees.map((employee) => employee.id));
            setRequestedTakeOffInput(formatDateTimeLocalInput(response.requestedTakeOffDateTime));
            setRoutePoints(createInitialRoutePoints(response));
            setGroundTimesMinutes(createInitialGroundTimes(response));
            setRoutePreview(null);
        } catch (error: unknown) {
            setErrorMessage(getApiErrorMessage(error, "Не удалось отправить заявку."));
        } finally {
            setIsActionLoading(false);
        }
    }

    async function handleDownloadTicket() {
        if (departure === null) {
            return;
        }

        setIsActionLoading(true);
        setErrorMessage("");

        try {
            const ticketBlob = await downloadUserDepartureTicket(departure.id);
            downloadBlob(ticketBlob, `Маршрутная квитанция ${departure.id}.pdf`);
        } catch {
            setErrorMessage("Не удалось сохранить маршрутную квитанцию.");
        } finally {
            setIsActionLoading(false);
        }
    }

    async function handleDownloadContract() {
        if (departure === null) {
            return;
        }

        if (hasUnsavedRouteChanges(departure, routePoints, groundTimesMinutes)) {
            setErrorMessage("Сначала сохраните изменения маршрута.");
            return;
        }

        setIsActionLoading(true);
        setErrorMessage("");

        try {
            const contractBlob = await downloadDepartureContract(departure.id);
            downloadBlob(contractBlob, `Договор ${departure.id}.pdf`);
        } catch (error: unknown) {
            setErrorMessage(getApiErrorMessage(error, "Не удалось сохранить шаблон договора."));
        } finally {
            setIsActionLoading(false);
        }
    }

    async function handleDownloadContractDocument() {
        if (departure === null) {
            return;
        }

        setIsActionLoading(true);
        setErrorMessage("");

        try {
            const contractBlob = await downloadDepartureContractDocument(departure.id);
            downloadBlob(contractBlob, departure.contractDocumentFileName || `Подписанный договор ${departure.id}.pdf`);
        } catch (error: unknown) {
            setErrorMessage(getApiErrorMessage(error, "Не удалось скачать загруженный договор."));
        } finally {
            setIsActionLoading(false);
        }
    }

    async function handleConfirmContractDocument() {
        if (departure === null) {
            return;
        }

        setIsActionLoading(true);
        setErrorMessage("");

        try {
            await confirmManagementDepartureContractDocument(departure.id);
            navigate("/management/flights");
        } catch (error: unknown) {
            setErrorMessage(getApiErrorMessage(error, "Не удалось подтвердить договор."));
        } finally {
            setIsActionLoading(false);
        }
    }

    async function handlePayDeparture() {
        if (departure === null || mode !== "client") {
            return;
        }

        setIsActionLoading(true);
        setErrorMessage("");

        try {
            await payUserDeparture(departure.id);
            await refreshDeparture();
        } catch (error: unknown) {
            setErrorMessage(getApiErrorMessage(error, "Не удалось оплатить вылет."));
        } finally {
            setIsActionLoading(false);
        }
    }

    async function handleSaveEmployees() {
        if (departure === null || mode !== "management") {
            return;
        }

        setIsActionLoading(true);
        setErrorMessage("");

        try {
            await updateManagementDepartureEmployees(departure.id, selectedEmployeeIds);
            await refreshDeparture();
        } catch (error: unknown) {
            setErrorMessage(getApiErrorMessage(error, "Не удалось сохранить сотрудников вылета."));
        } finally {
            setIsActionLoading(false);
        }
    }

    async function handleSetManagementStatus(
        statusId: number,
        includePreviousStatuses = false,
        targetLegIndex?: number | null
    ) {
        if (departure === null) {
            return;
        }

        if (statusId === 14) {
            setPendingCompletionStatus({
                statusId,
                includePreviousStatuses,
                targetLegIndex
            });
            return;
        }

        await applyManagementStatus(statusId, includePreviousStatuses, targetLegIndex);
    }

    async function applyManagementStatus(
        statusId: number,
        includePreviousStatuses = false,
        targetLegIndex?: number | null
    ) {
        if (departure === null) {
            return;
        }

        if (
            statusChangeRequiresCrew(statusId, includePreviousStatuses) &&
            departure.employees.length === 0
        ) {
            setErrorMessage("Для вылета назначьте хотя бы одного члена экипажа.");
            return;
        }

        setIsActionLoading(true);
        setErrorMessage("");

        try {
            await updateManagementDepartureStatus(
                departure.id,
                statusId,
                includePreviousStatuses,
                targetLegIndex
            );
            await refreshDeparture();
        } catch (error: unknown) {
            setErrorMessage(getApiErrorMessage(error, "Не удалось изменить статус вылета."));
        } finally {
            setIsActionLoading(false);
        }
    }

    async function handleConfirmCompletionStatus() {
        if (pendingCompletionStatus === null) {
            return;
        }

        const statusChange = pendingCompletionStatus;

        setPendingCompletionStatus(null);
        await applyManagementStatus(
            statusChange.statusId,
            statusChange.includePreviousStatuses,
            statusChange.targetLegIndex
        );
    }

    async function handleDeleteLatestManagementStatus() {
        if (departure === null) {
            return;
        }

        setIsActionLoading(true);
        setErrorMessage("");

        try {
            await deleteLatestManagementDepartureStatus(departure.id);
            await refreshDeparture();
        } catch (error: unknown) {
            setErrorMessage(getApiErrorMessage(error, "Не удалось удалить предыдущий статус."));
        } finally {
            setIsActionLoading(false);
        }
    }

    async function handleContractDocumentChange(event: ChangeEvent<HTMLInputElement>) {
        if (departure === null) {
            return;
        }

        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file) {
            return;
        }

        setIsActionLoading(true);
        setErrorMessage("");

        try {
            await uploadDepartureContractDocument(departure.id, file);
            await refreshDeparture();
        } catch (error: unknown) {
            setErrorMessage(getApiErrorMessage(error, "Не удалось загрузить договор."));
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

    async function refreshDeparture() {
        const response = mode === "management"
            ? await getManagementDeparture(parsedDepartureId)
            : await getUserDeparture(parsedDepartureId);

        setDeparture(response);
        setPendingPassengers(response.passengers);
        setSelectedEmployeeIds(response.employees.map((employee) => employee.id));
        setRequestedTakeOffInput(formatDateTimeLocalInput(response.requestedTakeOffDateTime));
        setRoutePoints(createInitialRoutePoints(response));
        setGroundTimesMinutes(createInitialGroundTimes(response));
        setRoutePreview(null);
    }

    function handleAddPassenger(passenger: PassengerSearchResponse) {
        if (departure === null || mode !== "client" || !departure.canEditRoute) {
            return;
        }

        setErrorMessage("");
        setPendingPassengers((currentPassengers) => {
            if (
                currentPassengers.some((currentPassenger) => currentPassenger.id === passenger.id) ||
                currentPassengers.length >= departure.planePassengerCapacity
            ) {
                return currentPassengers;
            }

            return [...currentPassengers, passenger];
        });
    }

    function handleRemovePassenger(personId: number) {
        if (departure === null || mode !== "client" || !departure.canEditRoute) {
            return;
        }

        setErrorMessage("");
        setPendingPassengers((currentPassengers) =>
            currentPassengers.filter((passenger) => passenger.id !== personId)
        );
    }

    function updatePassengerFormField(field: keyof ProfileFormData, value: string) {
        setPassengerForm((currentForm) => ({
            ...currentForm,
            [field]: value
        }));
    }

    async function handleCreatePassengerSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (departure === null || mode !== "client" || !departure.canEditRoute) {
            return;
        }

        setIsPassengerActionLoading(true);
        setErrorMessage("");

        try {
            const passenger = await createPassenger({
                ...passengerForm,
                patronymic: passengerForm.patronymic?.trim() || null,
                email: passengerForm.email?.trim() || null,
                birthDate: passengerForm.birthDate || null
            });

            setPendingPassengers((currentPassengers) => {
                if (currentPassengers.length >= departure.planePassengerCapacity) {
                    return currentPassengers;
                }

                return [...currentPassengers, passenger];
            });
            setPassengerForm(emptyPassengerForm);
            setIsPassengerModalOpen(false);
        } catch {
            setErrorMessage("Не удалось зарегистрировать пассажира.");
        } finally {
            setIsPassengerActionLoading(false);
        }
    }

    async function handleLoadPassengerForEdit(
        passenger: ManagementPassengerResponse,
        passportSeries: string,
        passportNumber: string
    ): Promise<PersonEditResponse> {
        setIsPassengerActionLoading(true);
        setErrorMessage("");

        try {
            return await getPassengerEditDetails(passenger.id, {
                passportSeries,
                passportNumber
            });
        } catch (error) {
            throw new Error(getPassengerApiErrorMessage(
                error,
                "Не удалось открыть карточку пассажира. Проверьте паспортные данные."
            ));
        } finally {
            setIsPassengerActionLoading(false);
        }
    }

    async function handleUpdatePassenger(
        passenger: ManagementPassengerResponse,
        currentPassportSeries: string,
        currentPassportNumber: string,
        form: ProfileFormData
    ) {
        if (departure === null || mode !== "client" || !departure.canEditRoute) {
            return;
        }

        setIsPassengerActionLoading(true);
        setErrorMessage("");

        try {
            await updatePassengerByPassport(passenger.id, {
                ...form,
                currentPassportSeries,
                currentPassportNumber,
                patronymic: form.patronymic?.trim() || null,
                email: form.email?.trim() || null,
                birthDate: form.birthDate || null
            });

            await refreshDeparture();
            setEditingPassenger(null);
        } catch (error) {
            throw new Error(getPassengerApiErrorMessage(
                error,
                "Не удалось сохранить данные пассажира. Проверьте паспортные данные."
            ));
        } finally {
            setIsPassengerActionLoading(false);
        }
    }

    const canEditPassengers = mode === "client" && departure?.canEditRoute === true;
    const hasFreePassengerSeat = departure !== null &&
        pendingPassengers.length < departure.planePassengerCapacity;
    const backTarget = getBackTarget(location.state, location.pathname, mode);

    function toggleSection(sectionKey: DepartureSectionKey) {
        setExpandedSections((currentSections) => {
            const nextSections = new Set(currentSections);

            if (nextSections.has(sectionKey)) {
                nextSections.delete(sectionKey);
            } else {
                nextSections.add(sectionKey);
            }

            return nextSections;
        });
    }

    function renderSectionCard(
        sectionKey: DepartureSectionKey,
        title: string,
        content: ReactNode,
        sideContent?: ReactNode,
        headerActions?: ReactNode,
        showHeaderActionsWhenCollapsed = false
    ) {
        const isExpanded = expandedSections.has(sectionKey);

        return (
            <section className={`management-card management-route-section ${isExpanded ? "expanded" : ""}`}>
                <div className="management-section-header-row">
                    <button
                        type="button"
                        className="management-card-summary management-section-toggle"
                        onClick={() => toggleSection(sectionKey)}
                        aria-expanded={isExpanded}
                    >
                        <span className={`management-card-chevron ${isExpanded ? "expanded" : ""}`}></span>
                        <span>{title}</span>
                        {sideContent && (
                            <span className="management-section-toggle-side">{sideContent}</span>
                        )}
                    </button>

                    {headerActions && (isExpanded || showHeaderActionsWhenCollapsed) && (
                        <div className="management-section-header-actions">
                            {headerActions}
                        </div>
                    )}
                </div>

                {isExpanded && (
                    <div className="management-card-details">
                        {content}
                    </div>
                )}
            </section>
        );
    }

    function renderBackButton() {
        return (
            <button
                type="button"
                className="header-icon-btn"
                onClick={() => navigate(backTarget)}
                title="Назад"
            >
                <svg viewBox="0 0 24 24">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
            </button>
        );
    }

    function getDepartureRouteTitle(currentDeparture: ManagementDepartureResponse): string {
        return `${buildAirportLabel(
            currentDeparture.takeOffAirportCity,
            currentDeparture.takeOffAirportName,
            currentDeparture.takeOffAirportIata,
            currentDeparture.takeOffAirportIcao
        )} → ${buildAirportLabel(
            currentDeparture.landingAirportCity,
            currentDeparture.landingAirportName,
            currentDeparture.landingAirportIata,
            currentDeparture.landingAirportIcao
        )}`;
    }

    function getRequestDateLabel(currentDeparture: ManagementDepartureResponse): string {
        return mode === "client" && currentDeparture.currentStatusId === 1
            ? "Создано"
            : "Дата подачи заявки";
    }

    function getRequestDateValue(currentDeparture: ManagementDepartureResponse): string | null | undefined {
        if (mode === "client" && currentDeparture.currentStatusId === 1) {
            return currentDeparture.createdAt;
        }

        return currentDeparture.submittedAt ?? currentDeparture.createdAt;
    }

    function renderFlightOverview(currentDeparture: ManagementDepartureResponse) {
        const canEditTakeOffDateTime = currentDeparture.canEditRoute &&
            (
                mode === "client" ||
                (mode === "management" && currentDeparture.currentStatusId === 2)
            );
        const isOrderTakeOffDateTimeWarning = !isFlightManagementPage &&
            (currentDeparture.currentStatusId === 1 || currentDeparture.currentStatusId === 2) &&
            (
                canEditTakeOffDateTime
                    ? isRequestedTakeOffTooEarly
                    : formatDateTimeLocalInput(currentDeparture.requestedTakeOffDateTime) < getTomorrowStartDateTimeLocalInput()
            );

        return (
            <section className="management-card management-flight-overview">
                <div className="management-flight-image">
                    {currentDeparture.planeImage ? (
                        <img
                            src={`data:image/png;base64,${currentDeparture.planeImage}`}
                            alt={currentDeparture.planeModelName}
                        />
                    ) : (
                        <img
                            src="/placeholder-plane.png"
                            alt={currentDeparture.planeModelName}
                        />
                    )}

                    {currentDeparture.airlineImage && (
                        <div className="management-flight-airline-badge">
                            <img
                                src={`data:image/png;base64,${currentDeparture.airlineImage}`}
                                alt={currentDeparture.airlineName}
                            />
                        </div>
                    )}

                    <div className="management-flight-hero-overlay">
                        <div className="management-flight-hero-title">
                            {mode === "management" && (
                                <span className="management-card-label">Заявка #{currentDeparture.id}</span>
                            )}
                            <h1>{currentDeparture.planeModelName}</h1>
                            <p>{getDepartureRouteTitle(currentDeparture)}</p>
                            <span className="management-flight-airline-name">
                                Исполнитель: {currentDeparture.airlineName}
                            </span>
                            <span className="management-flight-airline-contact">
                                Контакты исполнителя: {formatAirlineContactInfo(currentDeparture)}
                            </span>
                            <span className="management-flight-customer">
                                Заказчик: {formatCustomerInfo(currentDeparture)}
                            </span>
                        </div>

                        <div className="management-flight-overview-side">
                            <span className={`status-badge ${getRouteStatusClassName(currentDeparture.currentStatusId)}`}>
                                {currentDeparture.statusName}
                            </span>
                            <strong>{formatPrice(summaryPrice)}</strong>
                        </div>
                    </div>
                </div>

                <div className="management-flight-overview-body">
                    <div className="management-order-info-grid">
                        <InfoCell
                            label={getRequestDateLabel(currentDeparture)}
                            value={formatOptionalDateTime(getRequestDateValue(currentDeparture))}
                        />
                        {canEditTakeOffDateTime ? (
                            <EditableInfoCell
                                label="Дата и время вылета"
                                value={requestedTakeOffInput}
                                min={getTomorrowStartDateTimeLocalInput()}
                                isWarning={isOrderTakeOffDateTimeWarning}
                                onChange={setRequestedTakeOffInput}
                            />
                        ) : (
                            <InfoCell
                                label="Дата и время вылета"
                                value={formatDateTime(currentDeparture.requestedTakeOffDateTime)}
                                isWarning={isOrderTakeOffDateTimeWarning}
                            />
                        )}
                        <InfoCell label="Дата и время прибытия" value={formatDateTime(currentDeparture.arrivalDateTime)} />
                        <InfoCell label="Время в пути" value={formatDuration(summaryFlightTime)} />
                        <InfoCell label="Расстояние" value={`${formatNumber(summaryDistance)} км`} />
                        <InfoCell label="Пересадки" value={summaryTransfers.toString()} />
                    </div>
                </div>
            </section>
        );
    }

    function renderRouteEditor(currentDeparture: ManagementDepartureResponse) {
        const canEditRoute = currentDeparture.canEditRoute;

        return renderSectionCard(
            "route",
            canEditRoute ? "Редактирование маршрута" : "Маршрут",
            <>
                    {canEditRoute && (
                    <RouteCandidateChooser
                        activeRouteChoice={activeRouteChoice}
                        candidatesCount={routeCandidates.length}
                        onAirportSelect={handleAirportSelect}
                        onAddIntermediatePoint={handleInsertPointBefore}
                        onRemoveIntermediatePoint={handleRemovePoint}
                        onSegmentChange={handleCandidateSegmentChange}
                        onElementChange={setRouteChooserElement}
                    />
                    )}

                    <ManagementRouteMap
                        airports={mapAirports}
                        candidates={canEditRoute ? routeCandidates : []}
                        mapData={routeMapData}
                        mapInstance={mapInstance}
                        onCandidateSelect={handleRouteCandidateSelect}
                        onMapInstanceChange={setMapInstance}
                    />

                    <div className="management-route-chain">
                        {routePoints.slice(0, -1).map((routePoint, index) => {
                            const nextRoutePoint = routePoints[index + 1];
                            const legPreview = routePreview?.routeLegs[index];
                            const existingLeg = findExistingRouteLeg(
                                currentDeparture.routeLegs,
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
                                    canEdit={canEditRoute}
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
            </>,
            undefined,
            <div className="management-route-reset-summary">
                <span>{formatPrice(summaryPrice)}</span>
                {canEditRoute && (
                <button
                    type="button"
                    className="management-secondary-button management-compact-button"
                    onClick={handleResetRoute}
                >
                    Сбросить маршрут
                </button>
                )}
            </div>
        );
    }

    function renderFlightOperations(currentDeparture: ManagementDepartureResponse) {
        const timing = calculateFlightTiming(currentDeparture);
        const actualState = getActualFlightState(currentDeparture);
        const nextStatus = getSuggestedNextFlightStatus(currentDeparture, timing);
        const canChangeStatus = currentDeparture.canChangeStatus && !isActionLoading;
        const canDeleteLatestStatus = canChangeStatus && currentDeparture.currentStatusId > 4;
        const isCalculatedStatusCurrent = isCalculatedStatusAlreadyCurrent(currentDeparture, timing);
        const hasAssignedCrew = currentDeparture.employees.length > 0;
        const calculatedStatusRequiresCrew = statusChangeRequiresCrew(timing.statusId, true);
        const nextStatusRequiresCrew = statusChangeRequiresCrew(nextStatus.id, false);
        const canApplyCalculatedStatus = canChangeStatus &&
            !isCalculatedStatusCurrent &&
            !isStatusAheadOfCalculatedStatus(currentDeparture, timing) &&
            (!calculatedStatusRequiresCrew || hasAssignedCrew);
        const isNextStatusCompletion = nextStatus.id === 14;

        return renderSectionCard(
            "operations",
            "Управление статусом",
            <>
                <div className="management-flight-operation-grid">
                    <div className="management-flight-operation-panel">
                        <span>Расчётный статус: {timing.statusText}</span>
                        <p className="management-flight-operation-route">{timing.locationText}</p>
                        <p>{timing.timeWindowText}</p>
                    </div>

                    <div className="management-flight-operation-panel">
                        <span>Фактическое состояние: {actualState.statusText}</span>
                        <p className="management-flight-operation-route">{actualState.locationText}</p>
                        <p>Установлено {formatDateTime(currentDeparture.currentStatusSetAt)}.</p>
                    </div>

                    <div className="management-flight-operation-panel">
                        <span>Следующий статус</span>
                        <strong>{nextStatus.name}</strong>
                        <p>Предложение построено по маршруту и пересадкам.</p>
                    </div>
                </div>

                <FlightTimingTimeline departure={currentDeparture} />

                {!hasAssignedCrew && (calculatedStatusRequiresCrew || nextStatusRequiresCrew) && (
                    <p className="management-crew-warning">
                        Для вылета назначьте хотя бы одного члена экипажа.
                    </p>
                )}

                <div className="management-flight-status-actions">
                    <button
                        type="button"
                        className="management-danger-button"
                        onClick={handleDeleteLatestManagementStatus}
                        disabled={!canDeleteLatestStatus}
                    >
                        Удалить текущий статус
                    </button>
                    <button
                        type="button"
                        className="management-secondary-button"
                        onClick={() => handleSetManagementStatus(
                            timing.statusId,
                            true,
                            timing.currentLegIndex
                        )}
                        disabled={!canApplyCalculatedStatus}
                    >
                        Установить расчётный статус
                    </button>
                    <button
                        type="button"
                        className={`management-primary-button ${isNextStatusCompletion ? "management-complete-flight-button" : ""}`}
                        onClick={() => handleSetManagementStatus(nextStatus.id)}
                        disabled={!canChangeStatus ||
                            currentDeparture.currentStatusId === nextStatus.id ||
                            (nextStatusRequiresCrew && !hasAssignedCrew)}
                    >
                        {isNextStatusCompletion ? "Завершить вылет" : "Установить следующий статус"}
                    </button>
                </div>
            </>,
            <span className={`status-badge ${getRouteStatusClassName(currentDeparture.currentStatusId)}`}>
                {currentDeparture.statusName}
            </span>,
            undefined,
            true
        );
    }

    function renderPassengerSection(currentDeparture: ManagementDepartureResponse) {
        const displayedPassengers = canEditPassengers ? pendingPassengers : currentDeparture.passengers;

        return renderSectionCard(
            "passengers",
            "Пассажиры",
            <>
                    {displayedPassengers.length === 0 ? (
                        <p className="management-muted-text">Пассажиры не указаны.</p>
                    ) : (
                        <div className="management-passenger-list">
                            {displayedPassengers.map((passenger) => (
                                <div key={passenger.id} className="management-passenger-row">
                                    <span>{passenger.fullName}</span>
                                    <span>{passenger.email || "Почта не указана"}</span>
                                    {canEditPassengers && (
                                        <div className="management-passenger-row-actions">
                                            <button
                                                type="button"
                                                className="management-secondary-button management-passenger-edit-button"
                                                onClick={() => setEditingPassenger(passenger)}
                                                disabled={isPassengerActionLoading}
                                            >
                                                Изменить
                                            </button>
                                            <button
                                                type="button"
                                                className="management-route-remove-point management-passenger-remove-button"
                                                onClick={() => handleRemovePassenger(passenger.id)}
                                                disabled={isPassengerActionLoading}
                                                title="Удалить пассажира"
                                            >
                                                −
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {canEditPassengers && hasFreePassengerSeat && (
                        <div className="management-passenger-add-row">
                            <PassengerSearchInput
                                excludedPassengerIds={displayedPassengers.map((passenger) => passenger.id)}
                                disabled={isPassengerActionLoading}
                                onSelect={handleAddPassenger}
                            />

                            <button
                                type="button"
                                className="management-secondary-button management-passenger-create-button"
                                onClick={() => setIsPassengerModalOpen(true)}
                                disabled={isPassengerActionLoading}
                            >
                                Новый пассажир
                            </button>
                        </div>
                    )}

                    {canEditPassengers && !hasFreePassengerSeat && (
                        <p className="management-muted-text">Свободных мест в самолёте нет.</p>
                    )}
            </>,
            <span>{displayedPassengers.length} из {currentDeparture.planePassengerCapacity}</span>
        );
    }

    function renderStatusHistory(currentDeparture: ManagementDepartureResponse) {
        return renderSectionCard(
            "history",
            "История статусов",
            <>
                    {currentDeparture.statusHistory.length === 0 ? (
                        <p className="management-muted-text">История статусов недоступна.</p>
                    ) : (
                        <div className="management-status-history-list">
                            {currentDeparture.statusHistory.map((status, index) => (
                                <div key={`${status.id}-${status.setAt}-${index}`} className="management-status-history-row">
                                    <span className={`status-badge ${getRouteStatusClassName(status.id)}`}>
                                        {status.name}
                                    </span>
                                    <span>{formatDateTime(status.setAt)}</span>
                                </div>
                            ))}
                        </div>
                    )}
            </>
        );
    }

    function renderEmployeeSection(currentDeparture: ManagementDepartureResponse) {
        const selectedEmployeeIdSet = new Set(selectedEmployeeIds);
        const displayedEmployees = [...availableEmployees].sort((leftEmployee, rightEmployee) =>
            compareEmployeesForAssignment(leftEmployee, rightEmployee, selectedEmployeeIdSet)
        );

        return renderSectionCard(
            "employees",
            "Сотрудники вылета",
            <>
                {availableEmployees.length === 0 ? (
                    <p className="management-muted-text">Сотрудники авиакомпании не найдены.</p>
                ) : (
                    <div className="management-passenger-list">
                        {displayedEmployees.map((employee) => (
                            <label key={employee.id} className="management-passenger-row management-employee-row">
                                <span>
                                    <input
                                        type="checkbox"
                                        checked={selectedEmployeeIdSet.has(employee.id)}
                                        disabled={isActionLoading}
                                        onChange={(event) => {
                                            setSelectedEmployeeIds((currentIds) =>
                                                event.target.checked
                                                    ? [...currentIds, employee.id]
                                                    : currentIds.filter((employeeId) => employeeId !== employee.id)
                                            );
                                        }}
                                    />
                                    {employee.fullName || employee.email}
                                </span>
                                <span>{employee.roleName}</span>
                            </label>
                        ))}
                    </div>
                )}
            </>,
            <span>{currentDeparture.employees.length} назначено</span>,
            <button
                type="button"
                className="management-secondary-button management-compact-button"
                onClick={handleSaveEmployees}
                disabled={isActionLoading || areNumberArraysEqual(
                    selectedEmployeeIds,
                    currentDeparture.employees.map((employee) => employee.id)
                )}
            >
                Сохранить
            </button>
        );
    }

    return (
        <div className="catalog-wrapper">
            <Header showSearch={false}>
                {renderBackButton()}
            </Header>

            <div className="management-route-standalone">
                <main className="catalog-main management-route-page">
                    {isLoading ? (
                        <div className="management-empty-state">Загрузка заявки...</div>
                    ) : departure === null ? (
                        <div className="management-empty-state">
                            {errorMessage || "Заявка не найдена."}
                        </div>
                    ) : (
                        <>
                            {renderFlightOverview(departure)}

                            {isFlightManagementPage && renderFlightOperations(departure)}
                            {mode === "client" && renderPassengerSection(departure)}
                            {mode === "management" && isFlightManagementPage && renderEmployeeSection(departure)}
                            {renderStatusHistory(departure)}
                            {renderRouteEditor(departure)}
                            {mode === "management" && renderPassengerSection(departure)}

                            {(errorMessage !== "" || requestedTakeOffDateTimeError !== "" || unsavedDepartureChangesMessage !== "") && (
                                <div className={`management-inline-error ${errorMessage === "" && requestedTakeOffDateTimeError === "" ? "warning" : ""}`}>
                                    {errorMessage || requestedTakeOffDateTimeError || unsavedDepartureChangesMessage}
                                </div>
                            )}

                            <div className="management-route-actions">
                                {canDeleteDeparture && (
                                    <button
                                        type="button"
                                        className="management-danger-button"
                                        onClick={() => setIsDeleteDepartureConfirmOpen(true)}
                                        disabled={isActionLoading}
                                    >
                                        Удалить заявку
                                    </button>
                                )}

                                {mode === "management" && departure.canApprove && (
                                    <button
                                        type="button"
                                        className="management-danger-button"
                                        onClick={handleReject}
                                        disabled={isActionLoading || !departure.canApprove}
                                    >
                                        Отклонить
                                    </button>
                                )}

                                {mode === "client" && (
                                    <button
                                        type="button"
                                        className="management-secondary-button"
                                        disabled={isActionLoading}
                                        onClick={handleDownloadTicket}
                                    >
                                        Сохранить маршрутную квитанцию
                                    </button>
                                )}
                                {canDownloadContractTemplate && (
                                    <button
                                    type="button"
                                    className="management-secondary-button"
                                    onClick={handleDownloadContract}
                                    disabled={isActionLoading}
                                >
                                    Сохранить шаблон договора
                                    </button>
                                )}
                                {canUploadContractDocument && (
                                    <>
                                        <input
                                            ref={contractFileInputRef}
                                            type="file"
                                            className="management-hidden-file-input"
                                            accept=".pdf,.doc,.docx,image/*"
                                            onChange={handleContractDocumentChange}
                                        />
                                        <button
                                            type="button"
                                            className="management-secondary-button"
                                            onClick={() => contractFileInputRef.current?.click()}
                                            disabled={isActionLoading}
                                        >
                                            {mode === "management" ? "Загрузить итоговый договор" : "Загрузить подписанный договор"}
                                        </button>
                                    </>
                                )}
                                {mode === "client" && departure.canPay && (
                                    <button
                                        type="button"
                                        className="management-primary-button management-pay-button"
                                        onClick={handlePayDeparture}
                                        disabled={isActionLoading}
                                    >
                                        Оплатить
                                    </button>
                                )}
                                {departure.hasContractDocument && (
                                    <button
                                        type="button"
                                        className="management-secondary-button management-contract-document-button"
                                        onClick={handleDownloadContractDocument}
                                        disabled={isActionLoading}
                                    >
                                        Скачать подписанный договор
                                    </button>
                                )}
                                {mode === "management" && departure.currentStatusId === 19 && departure.contractDocumentUploadedByAirline && (
                                    <button
                                        type="button"
                                        className="management-primary-button"
                                        onClick={handleConfirmContractDocument}
                                        disabled={isActionLoading}
                                    >
                                        Подтвердить договор
                                    </button>
                                )}
                                {departure.canEditRoute && (
                                <button
                                    type="button"
                                    className="management-secondary-button"
                                    onClick={handleSaveRoute}
                                    disabled={
                                        isActionLoading ||
                                        !canSaveDepartureChanges
                                    }
                                >
                                    Сохранить
                                </button>
                                )}

                                {mode === "client" && departure.currentStatusId === 1 && (
                                    <button
                                        type="button"
                                        className="management-primary-button"
                                        onClick={handleSubmitApplication}
                                        disabled={
                                            isActionLoading ||
                                            !departure.canEditRoute
                                        }
                                    >
                                        Отправить заявку
                                    </button>
                                )}

                                {mode === "management" && departure.canApprove && (
                                    <button
                                        type="button"
                                        className="management-primary-button"
                                        onClick={handleApprove}
                                        disabled={
                                            isActionLoading ||
                                            !canApproveDeparture
                                        }
                                    >
                                        Одобрить
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </main>

            {isPassengerModalOpen && (
                <PassengerRegistrationModal
                    form={passengerForm}
                    isLoading={isPassengerActionLoading}
                    onChange={updatePassengerFormField}
                    onClose={() => setIsPassengerModalOpen(false)}
                    onSubmit={handleCreatePassengerSubmit}
                />
            )}

            {editingPassenger !== null && (
                <PassengerEditModal
                    passenger={editingPassenger}
                    isLoading={isPassengerActionLoading}
                    onClose={() => setEditingPassenger(null)}
                    onLoad={handleLoadPassengerForEdit}
                    onSubmit={handleUpdatePassenger}
                />
            )}

            {pendingCompletionStatus !== null && departure !== null && (
                <FlightCompletionConfirmModal
                    departure={departure}
                    isLoading={isActionLoading}
                    onClose={() => setPendingCompletionStatus(null)}
                    onConfirm={handleConfirmCompletionStatus}
                />
            )}

            {isDeleteDepartureConfirmOpen && departure !== null && (
                <DeleteDepartureConfirmModal
                    departure={departure}
                    isLoading={isActionLoading}
                    onClose={() => setIsDeleteDepartureConfirmOpen(false)}
                    onConfirm={handleDeleteDeparture}
                />
            )}
            </div>
        </div>
    );
}

function getPassengerApiErrorMessage(error: unknown, fallback: string): string {
    if (typeof error !== "object" || error === null || !("status" in error)) {
        return fallback;
    }

    const status = Number((error as { status?: number }).status);

    if (status === 404) {
        return "Текущие паспортные данные не совпадают с выбранным пассажиром.";
    }

    if (status === 409) {
        return "Пассажир с такими паспортными данными уже есть. Найдите его через поиск и выберите существующую запись.";
    }

    return fallback;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
    if (typeof error === "object" && error !== null && "message" in error) {
        const message = error.message;

        if (typeof message === "string" && message.trim() !== "") {
            return message.trim();
        }
    }

    return fallback;
}

function getApiStatus(error: unknown): number | null {
    if (typeof error !== "object" || error === null || !("status" in error)) {
        return null;
    }

    const status = Number((error as { status?: unknown }).status);

    return Number.isNaN(status) ? null : status;
}

function getBackTarget(
    state: unknown,
    pathname: string,
    mode: "management" | "client"
): string {
    if (
        typeof state === "object" &&
        state !== null &&
        "backTo" in state &&
        typeof (state as { backTo?: unknown }).backTo === "string"
    ) {
        const backTo = (state as { backTo: string }).backTo;

        if (backTo.startsWith("/management/") || backTo === "/cabinet") {
            return backTo;
        }
    }

    if (mode === "client") {
        return "/cabinet";
    }

    if (pathname.includes("/management/flights/")) {
        return "/management/flights";
    }

    if (pathname.includes("/management/completed/")) {
        return "/management/completed";
    }

    return "/management/orders";
}

function hasUnsavedRouteChanges(
    departure: ManagementDepartureResponse,
    routePoints: RoutePoint[],
    groundTimesMinutes: Array<number | null>
): boolean {
    const savedAirportIds = createInitialRoutePoints(departure).map((routePoint) => routePoint.airportId);
    const currentAirportIds = routePoints.map((routePoint) => routePoint.airportId);

    if (savedAirportIds.length !== currentAirportIds.length) {
        return true;
    }

    if (savedAirportIds.some((airportId, index) => airportId !== currentAirportIds[index])) {
        return true;
    }

    const savedGroundTimes = createInitialGroundTimes(departure).slice(0, -1);
    const currentGroundTimes = groundTimesMinutes.slice(0, savedGroundTimes.length);

    if (savedGroundTimes.length !== currentGroundTimes.length) {
        return true;
    }

    return savedGroundTimes.some((minutes, index) => minutes !== currentGroundTimes[index]);
}

function downloadBlob(blob: Blob, fileName: string) {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
}

function formatCustomerInfo(departure: ManagementDepartureResponse): string {
    const fullName = departure.charterRequesterFullName?.trim();

    if (fullName) {
        return `${fullName}, ${departure.charterRequesterEmail}`;
    }

    return departure.charterRequesterEmail;
}

function formatAirlineContactInfo(departure: ManagementDepartureResponse): string {
    const contactParts = [
        departure.airlineEmail,
        departure.airlinePhoneNumber
    ]
        .map((part) => part?.trim())
        .filter((part): part is string => Boolean(part));

    return contactParts.length > 0
        ? contactParts.join(", ")
        : "не указаны";
}

function calculateFlightTiming(departure: ManagementDepartureResponse): {
    statusText: string;
    statusId: number;
    description: string;
    locationText: string;
    timeWindowText: string;
    currentLegIndex: number | null;
    isGroundTransfer: boolean;
    isCompleted: boolean;
} {
    const takeOffDate = new Date(departure.requestedTakeOffDateTime);

    if (Number.isNaN(takeOffDate.getTime()) || departure.routeLegs.length === 0) {
        return {
            statusText: "Нет расчёта",
            statusId: 3,
            description: "Недостаточно данных маршрута.",
            locationText: getDepartureRouteTitleFromAirports(departure),
            timeWindowText: "Маршрут не рассчитан.",
            currentLegIndex: null,
            isGroundTransfer: false,
            isCompleted: false
        };
    }

    const now = new Date();
    let cursor = takeOffDate;

    if (now < cursor) {
        return {
            statusText: "Ожидает вылета",
            statusId: 3,
            description: "Самолёт должен находиться в аэропорту отправления.",
            locationText: getAirportLabelById(departure, departure.routeLegs[0].fromAirportId),
            timeWindowText: `Вылет запланирован на ${formatDateTime(departure.requestedTakeOffDateTime)}.`,
            currentLegIndex: null,
            isGroundTransfer: false,
            isCompleted: false
        };
    }

    for (let index = 0; index < departure.routeLegs.length; index++) {
        const leg = departure.routeLegs[index];
        const legStart = cursor;
        const legEnd = addMinutes(legStart, timeSpanToMinutes(leg.flightTime) ?? 0);

        if (now <= legEnd) {
            return {
                statusText: "В пути",
                statusId: 13,
                description: `Выполняется плечо ${index + 1} из ${departure.routeLegs.length}.`,
                locationText: `${getAirportLabelById(departure, leg.fromAirportId)} -> ${getAirportLabelById(departure, leg.toAirportId)}`,
                timeWindowText: `${formatDateTime(legStart.toISOString())} -> ${formatDateTime(legEnd.toISOString())}`,
                currentLegIndex: index,
                isGroundTransfer: false,
                isCompleted: false
            };
        }

        const groundMinutes = timeSpanToMinutes(leg.groundTimeAfterArrival) ?? 0;
        const isIntermediateStop = index < departure.routeLegs.length - 1 && groundMinutes > 0;
        const groundEnd = addMinutes(legEnd, groundMinutes);

        if (isIntermediateStop && now <= groundEnd) {
            return {
                statusText: "На промежуточной посадке",
                statusId: 21,
                description: `Самолёт ожидает следующий взлёт, плечо ${index + 2} из ${departure.routeLegs.length}.`,
                locationText: getAirportLabelById(departure, leg.toAirportId),
                timeWindowText: `${formatDateTime(legEnd.toISOString())} -> ${formatDateTime(groundEnd.toISOString())}`,
                currentLegIndex: index,
                isGroundTransfer: true,
                isCompleted: false
            };
        }

        cursor = groundEnd;
    }

    return {
        statusText: "Вылет завершён",
        statusId: 14,
        description: "Расчётное время маршрута уже прошло.",
        locationText: getAirportLabelById(departure, departure.landingAirportId),
        timeWindowText: `Расчётное прибытие: ${formatDateTime(departure.arrivalDateTime)}.`,
        currentLegIndex: departure.routeLegs.length - 1,
        isGroundTransfer: false,
        isCompleted: true
    };
}

function getActualFlightState(departure: ManagementDepartureResponse): {
    statusText: string;
    locationText: string;
} {
    if (departure.routeLegs.length === 0) {
        return {
            statusText: departure.statusName,
            locationText: getDepartureRouteTitleFromAirports(departure)
        };
    }

    if (departure.currentStatusId === 13) {
        const legIndex = getActualCurrentRouteLegIndex(departure) ?? 0;
        const leg = departure.routeLegs[legIndex];

        return {
            statusText: departure.statusName,
            locationText: `${getAirportLabelById(departure, leg.fromAirportId)} -> ${getAirportLabelById(departure, leg.toAirportId)}`
        };
    }

    if (departure.currentStatusId === 21) {
        const legIndex = getActualCurrentRouteLegIndex(departure) ?? 0;
        const leg = departure.routeLegs[Math.max(legIndex, 0)];

        return {
            statusText: departure.statusName,
            locationText: getAirportLabelById(departure, leg.toAirportId)
        };
    }

    if (departure.currentStatusId === 14) {
        return {
            statusText: departure.statusName,
            locationText: getAirportLabelById(departure, departure.landingAirportId)
        };
    }

    return {
        statusText: departure.statusName,
        locationText: getAirportLabelById(departure, departure.routeLegs[0].fromAirportId)
    };
}

function getActualCurrentRouteLegIndex(departure: ManagementDepartureResponse): number | null {
    if (departure.routeLegs.length === 0) {
        return null;
    }

    if (departure.currentStatusId === 13) {
        return Math.min(
            Math.max(getStatusOccurrenceCount(departure, 13) - 1, 0),
            departure.routeLegs.length - 1
        );
    }

    if (departure.currentStatusId === 21) {
        return Math.min(
            Math.max(getStatusOccurrenceCount(departure, 21) - 1, 0),
            Math.max(departure.routeLegs.length - 2, 0)
        );
    }

    if (departure.currentStatusId === 14) {
        return departure.routeLegs.length - 1;
    }

    return 0;
}

function getStatusOccurrenceCount(
    departure: ManagementDepartureResponse,
    statusId: number
): number {
    return departure.statusHistory.filter((status) => status.id === statusId).length;
}

function getSuggestedNextFlightStatus(
    departure: ManagementDepartureResponse,
    timing: ReturnType<typeof calculateFlightTiming>
): { id: number; name: string } {
    switch (departure.currentStatusId) {
        case 3:
            return { id: 5, name: "Регистрация открыта" };
        case 4:
            return { id: 5, name: "Регистрация открыта" };
        case 5:
            return { id: 6, name: "Закрывается регистрация" };
        case 6:
            return { id: 7, name: "Регистрация закрыта" };
        case 7:
            return { id: 8, name: "Ожидает посадки" };
        case 8:
            return { id: 9, name: "Посадка" };
        case 9:
            return { id: 10, name: "Выход открыт" };
        case 10:
            return { id: 11, name: "Выход закрыт" };
        case 11:
            return { id: 12, name: "Посадка завершена" };
        case 12:
            return { id: 13, name: "В пути" };
        case 13:
            if ((getActualCurrentRouteLegIndex(departure) ?? 0) < departure.routeLegs.length - 1) {
                return { id: 21, name: "На промежуточной посадке" };
            }

            return { id: 14, name: "Приземлился" };
        case 21:
            return { id: 13, name: "В пути" };
        default:
            return timing.isCompleted
                ? { id: 14, name: "Приземлился" }
                : { id: 13, name: "В пути" };
    }
}

function isStatusAheadOfCalculatedStatus(
    departure: ManagementDepartureResponse,
    timing: ReturnType<typeof calculateFlightTiming>
): boolean {
    const sequence = buildOperationalStatusSequence(
        Math.max(1, departure.routeLegs.length),
        timing.currentLegIndex ?? 0,
        timing.statusId
    );
    const currentIndex = getCurrentOperationalStatusSequenceIndex(departure, sequence);
    const calculatedIndex = sequence.lastIndexOf(timing.statusId);

    return currentIndex >= 0 && calculatedIndex >= 0 && currentIndex > calculatedIndex;
}

function statusChangeRequiresCrew(statusId: number, includePreviousStatuses: boolean): boolean {
    if (statusId === 13) {
        return true;
    }

    return includePreviousStatuses && (statusId === 14 || statusId === 21);
}

function isCalculatedStatusAlreadyCurrent(
    departure: ManagementDepartureResponse,
    timing: ReturnType<typeof calculateFlightTiming>
): boolean {
    const sequence = buildOperationalStatusSequence(
        Math.max(1, departure.routeLegs.length),
        timing.currentLegIndex ?? 0,
        timing.statusId
    );
    const currentIndex = getCurrentOperationalStatusSequenceIndex(departure, sequence);
    const calculatedIndex = sequence.lastIndexOf(timing.statusId);

    return currentIndex >= 0 && calculatedIndex >= 0 && currentIndex === calculatedIndex;
}

function getCurrentOperationalStatusSequenceIndex(
    departure: ManagementDepartureResponse,
    sequence: number[]
): number {
    if (departure.currentStatusId === 13 || departure.currentStatusId === 21) {
        const occurrenceIndex = Math.max(
            getStatusOccurrenceCount(departure, departure.currentStatusId) - 1,
            0
        );
        const sequenceIndex = findStatusSequenceIndexByOccurrence(
            sequence,
            departure.currentStatusId,
            occurrenceIndex
        );

        return sequenceIndex >= 0 ? sequenceIndex : sequence.length;
    }

    return sequence.indexOf(departure.currentStatusId);
}

function findStatusSequenceIndexByOccurrence(
    sequence: number[],
    statusId: number,
    occurrenceIndex: number
): number {
    let seenCount = 0;

    for (let index = 0; index < sequence.length; index++) {
        if (sequence[index] !== statusId) {
            continue;
        }

        if (seenCount === occurrenceIndex) {
            return index;
        }

        seenCount++;
    }

    return -1;
}

function buildOperationalStatusSequence(
    routeLegCount: number,
    targetLegIndex: number,
    targetStatusId: number
): number[] {
    const sequence = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    const normalizedTargetLegIndex = Math.min(
        Math.max(targetLegIndex, 0),
        routeLegCount - 1
    );

    for (let legIndex = 0; legIndex < normalizedTargetLegIndex; legIndex++) {
        sequence.push(21, 13);
    }

    if (targetStatusId === 21) {
        sequence.push(21);
    } else if (targetStatusId === 14) {
        sequence.push(14);
    }

    return sequence;
}

type FlightTimelineItem = {
    type: "key" | "ground";
    phase: "departure" | "arrival";
    index: number;
    time: string;
    title: string;
    detail: string;
};

function FlightTimingTimeline({ departure }: { departure: ManagementDepartureResponse }) {
    const timeline = createFlightTimeline(departure);
    const currentTimelineIndex = getCurrentStatusTimelineIndex(departure, timeline);
    const calculatedTimelineIndex = getCalculatedTimelineIndex(departure, timeline);

    if (timeline.length === 0) {
        return null;
    }

    return (
        <div className="management-flight-timeline">
            {timeline.map((item, index) => (
                <div
                    key={`${item.type}-${item.index}`}
                    className={`management-flight-timeline-row ${item.type} ${index === currentTimelineIndex ? "current" : ""} ${index === calculatedTimelineIndex && index !== currentTimelineIndex ? "calculated" : ""}`}
                >
                    <span className="management-flight-timeline-time">{item.time}</span>
                    <span className="management-flight-timeline-title">{item.title}</span>
                    <span className="management-flight-timeline-detail">{item.detail}</span>
                </div>
            ))}
        </div>
    );
}

function createFlightTimeline(departure: ManagementDepartureResponse): FlightTimelineItem[] {
    const takeOffDate = new Date(departure.requestedTakeOffDateTime);

    if (Number.isNaN(takeOffDate.getTime())) {
        return [];
    }

    const timeline: FlightTimelineItem[] = [];
    let cursor = takeOffDate;

    departure.routeLegs.forEach((leg, index) => {
        const legStart = cursor;
        const legEnd = addMinutes(legStart, timeSpanToMinutes(leg.flightTime) ?? 0);
        const fromAirport = getAirportLabelById(departure, leg.fromAirportId);
        const toAirport = getAirportLabelById(departure, leg.toAirportId);
        const groundMinutes = timeSpanToMinutes(leg.groundTimeAfterArrival) ?? 0;
        const hasIntermediateStop = index < departure.routeLegs.length - 1;
        let arrivalDetail = "Финальная точка маршрута";

        if (hasIntermediateStop) {
            arrivalDetail = groundMinutes > 0
                ? `Промежуточная посадка, стоянка ${formatDuration(minutesToTimeSpan(groundMinutes))}`
                : "Промежуточная точка маршрута";
        }

        timeline.push({
            type: "key",
            phase: "departure",
            index: index * 2,
            time: formatTimelineDateTime(legStart),
            title: `Вылет из ${fromAirport}`,
            detail: `В пути ${formatDuration(leg.flightTime)}`
        });

        timeline.push({
            type: "ground",
            phase: "arrival",
            index: index * 2 + 1,
            time: formatTimelineDateTime(legEnd),
            title: `Прибытие в ${toAirport}`,
            detail: arrivalDetail
        });

        cursor = hasIntermediateStop
            ? addMinutes(legEnd, groundMinutes)
            : legEnd;
    });

    return timeline;
}

function getCurrentStatusTimelineIndex(
    departure: ManagementDepartureResponse,
    timeline: ReturnType<typeof createFlightTimeline>
): number {
    if (timeline.length === 0) {
        return -1;
    }

    if (departure.currentStatusId === 13) {
        const legIndex = getActualCurrentRouteLegIndex(departure) ?? 0;
        const flightIndex = timeline.findIndex((item) =>
            item.phase === "departure" &&
            item.index === legIndex * 2
        );

        return flightIndex >= 0 ? flightIndex : 0;
    }

    if (departure.currentStatusId === 21) {
        const legIndex = getActualCurrentRouteLegIndex(departure) ?? 0;
        const landingIndex = timeline.findIndex((item) =>
            item.phase === "arrival" &&
            item.index === legIndex * 2 + 1
        );

        return landingIndex;
    }

    if (departure.currentStatusId === 14) {
        for (let index = timeline.length - 1; index >= 0; index--) {
            if (timeline[index].phase === "arrival") {
                return index;
            }
        }
    }

    return 0;
}

function getCalculatedTimelineIndex(
    departure: ManagementDepartureResponse,
    timeline: ReturnType<typeof createFlightTimeline>
): number {
    if (timeline.length === 0) {
        return -1;
    }

    const calculated = calculateFlightTiming(departure);

    if (calculated.statusId === 13) {
        const legIndex = calculated.currentLegIndex ?? 0;

        return timeline.findIndex((item) =>
            item.phase === "departure" &&
            item.index === legIndex * 2
        );
    }

    if (calculated.statusId === 21) {
        const legIndex = calculated.currentLegIndex ?? 0;

        return timeline.findIndex((item) =>
            item.phase === "arrival" &&
            item.index === legIndex * 2 + 1
        );
    }

    if (calculated.statusId === 14) {
        for (let index = timeline.length - 1; index >= 0; index--) {
            if (timeline[index].phase === "arrival") {
                return index;
            }
        }
    }

    return 0;
}

function formatTimelineDateTime(date: Date): string {
    return date.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function getAirportLabelById(departure: ManagementDepartureResponse, airportId: number): string {
    const airport = departure.routeAirports.find((routeAirport) => routeAirport.id === airportId);

    return airport ? getAirportDisplayName(airport) : airportId.toString();
}

function getDepartureRouteTitleFromAirports(departure: ManagementDepartureResponse): string {
    return `${getAirportLabelById(departure, departure.takeOffAirportId)} -> ${getAirportLabelById(departure, departure.landingAirportId)}`;
}

function addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60_000);
}

function formatDateTimeLocalInput(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getTomorrowLocalDateInput(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    return formatDateTimeLocalInput(tomorrow.toISOString()).slice(0, 10);
}

function getTomorrowStartDateTimeLocalInput(): string {
    return `${getTomorrowLocalDateInput()}T00:00`;
}

function getRouteStatusClassName(statusId: number): string {
    if (statusId === 17 || statusId === 18) {
        return "rejected";
    }

    if (statusId === 2 || statusId === 19 || statusId === 20) {
        return "pending";
    }

    if (statusId === 14) {
        return "confirmed";
    }

    return "active";
}

function PassengerSearchInput({
    excludedPassengerIds,
    disabled,
    onSelect
}: {
    excludedPassengerIds: number[];
    disabled: boolean;
    onSelect: (passenger: PassengerSearchResponse) => void;
}) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<PassengerSearchResponse[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const trimmedQuery = query.trim();

        if (trimmedQuery.length < 2 || disabled) {
            setResults([]);
            setIsOpen(false);
            return;
        }

        const excludedIds = new Set(excludedPassengerIds);
        const abortController = new AbortController();
        const timeoutId = window.setTimeout(async () => {
            try {
                const passengers = await searchPassengers(trimmedQuery, abortController.signal);
                setResults(passengers.filter((passenger) => !excludedIds.has(passenger.id)));
                setIsOpen(true);
            } catch {
                if (!abortController.signal.aborted) {
                    setResults([]);
                    setIsOpen(false);
                }
            }
        }, 300);

        return () => {
            abortController.abort();
            window.clearTimeout(timeoutId);
        };
    }, [disabled, excludedPassengerIds, query]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    function handleSelect(passenger: PassengerSearchResponse) {
        setQuery("");
        setResults([]);
        setIsOpen(false);
        onSelect(passenger);
    }

    return (
        <div className="management-passenger-search" ref={dropdownRef}>
            <InputField
                label=""
                placeholder="ФИО, почта или паспорт..."
                value={query}
                onChange={setQuery}
                onFocus={() => {
                    if (results.length > 0) {
                        setIsOpen(true);
                    }
                }}
                autoComplete="off"
            />

            {isOpen && results.length > 0 && (
                <ul className="management-passenger-dropdown">
                    {results.map((passenger) => (
                        <li key={passenger.id} onClick={() => handleSelect(passenger)}>
                            <span>{passenger.fullName}</span>
                            <span>{passenger.email || "Почта не указана"}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function FlightCompletionConfirmModal({
    departure,
    isLoading,
    onClose,
    onConfirm
}: {
    departure: ManagementDepartureResponse;
    isLoading: boolean;
    onClose: () => void;
    onConfirm: () => void;
}) {
    return (
        <div className="management-modal-backdrop" role="presentation" onMouseDown={onClose}>
            <section
                className="management-passenger-modal management-confirm-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="flight-completion-title"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="management-passenger-modal-header">
                    <div>
                        <h3 id="flight-completion-title">Завершить вылет?</h3>
                        <span>{getDepartureRouteTitleFromAirports(departure)}</span>
                    </div>
                    <button type="button" onClick={onClose} disabled={isLoading} aria-label="Закрыть">
                        ×
                    </button>
                </div>

                <p className="management-passenger-modal-note">
                    Будет установлен финальный статус «Приземлился», а вылет перейдёт из текущих в завершённые.
                    Если самолёт ещё не приземлился, лучше отменить действие и дождаться фактической посадки.
                </p>

                <div className="management-confirm-summary">
                    <span>Текущий статус</span>
                    <strong>{departure.statusName}</strong>
                    <span>Расчётное прибытие</span>
                    <strong>{formatDateTime(departure.arrivalDateTime)}</strong>
                </div>

                <div className="management-passenger-modal-actions">
                    <button
                        type="button"
                        className="management-secondary-button"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        Отмена
                    </button>
                    <button
                        type="button"
                        className="management-primary-button management-complete-flight-button"
                        onClick={onConfirm}
                        disabled={isLoading}
                    >
                        Завершить вылет
                    </button>
                </div>
            </section>
        </div>
    );
}

function DeleteDepartureConfirmModal({
    departure,
    isLoading,
    onClose,
    onConfirm
}: {
    departure: ManagementDepartureResponse;
    isLoading: boolean;
    onClose: () => void;
    onConfirm: () => void;
}) {
    return (
        <div className="management-modal-backdrop" role="presentation" onMouseDown={onClose}>
            <section
                className="management-passenger-modal management-confirm-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="departure-delete-title"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="management-passenger-modal-header">
                    <div>
                        <h3 id="departure-delete-title">Удалить заявку?</h3>
                        <span>{getDepartureRouteTitleFromAirports(departure)}</span>
                    </div>
                    <button type="button" onClick={onClose} disabled={isLoading} aria-label="Закрыть">
                        ×
                    </button>
                </div>

                <p className="management-passenger-modal-note">
                    Заявка будет удалена вместе с маршрутом, пассажирами и историей статусов. Это действие нельзя отменить.
                </p>

                <div className="management-confirm-summary">
                    <span>Текущий статус</span>
                    <strong>{departure.statusName}</strong>
                    <span>Дата создания</span>
                    <strong>{formatOptionalDateTime(departure.createdAt)}</strong>
                </div>

                <div className="management-passenger-modal-actions">
                    <button
                        type="button"
                        className="management-secondary-button"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        Отмена
                    </button>
                    <button
                        type="button"
                        className="management-danger-button"
                        onClick={onConfirm}
                        disabled={isLoading}
                    >
                        Удалить заявку
                    </button>
                </div>
            </section>
        </div>
    );
}

function PassengerRegistrationModal({
    form,
    isLoading,
    onChange,
    onClose,
    onSubmit
}: {
    form: ProfileFormData;
    isLoading: boolean;
    onChange: (field: keyof ProfileFormData, value: string) => void;
    onClose: () => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
    return (
        <div className="management-modal-backdrop" role="presentation" onMouseDown={onClose}>
            <form
                className="management-passenger-modal"
                onSubmit={onSubmit}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="management-passenger-modal-header">
                    <h3>Новый пассажир</h3>
                    <button type="button" onClick={onClose} aria-label="Закрыть">
                        ×
                    </button>
                </div>

                <div className="management-passenger-modal-grid">
                    <InputField
                        label="Фамилия"
                        value={form.lastName}
                        onChange={(value) => onChange("lastName", value)}
                        required
                    />
                    <InputField
                        label="Имя"
                        value={form.firstName}
                        onChange={(value) => onChange("firstName", value)}
                        required
                    />
                    <InputField
                        label="Отчество"
                        value={form.patronymic ?? ""}
                        onChange={(value) => onChange("patronymic", value)}
                    />
                    <InputField
                        label="Серия паспорта"
                        value={form.passportSeries}
                        onChange={(value) => onChange("passportSeries", value.replace(/\D/g, "").slice(0, 4))}
                        maxLength={4}
                        required
                    />
                    <InputField
                        label="Номер паспорта"
                        value={form.passportNumber}
                        onChange={(value) => onChange("passportNumber", value.replace(/\D/g, "").slice(0, 6))}
                        maxLength={6}
                        required
                    />
                    <InputField
                        label="Почта для уведомлений"
                        value={form.email ?? ""}
                        onChange={(value) => onChange("email", value)}
                        type="email"
                    />
                    <InputField
                        label="Дата рождения"
                        value={form.birthDate ?? ""}
                        onChange={(value) => onChange("birthDate", value)}
                        type="date"
                    />
                </div>

                <div className="management-passenger-modal-actions">
                    <button
                        type="button"
                        className="management-secondary-button"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        Отмена
                    </button>
                    <button
                        type="submit"
                        className="management-primary-button"
                        disabled={isLoading}
                    >
                        Добавить
                    </button>
                </div>
            </form>
        </div>
    );
}

function PassengerEditModal({
    passenger,
    isLoading,
    onClose,
    onLoad,
    onSubmit
}: {
    passenger: ManagementPassengerResponse;
    isLoading: boolean;
    onClose: () => void;
    onLoad: (
        passenger: ManagementPassengerResponse,
        passportSeries: string,
        passportNumber: string
    ) => Promise<PersonEditResponse>;
    onSubmit: (
        passenger: ManagementPassengerResponse,
        currentPassportSeries: string,
        currentPassportNumber: string,
        form: ProfileFormData
    ) => Promise<void>;
}) {
    const [passportSeries, setPassportSeries] = useState("");
    const [passportNumber, setPassportNumber] = useState("");
    const [form, setForm] = useState<ProfileFormData | null>(null);
    const [localError, setLocalError] = useState("");

    function updateField(field: keyof ProfileFormData, value: string) {
        setForm((currentForm) => {
            if (currentForm === null) {
                return currentForm;
            }

            return {
                ...currentForm,
                [field]: value
            };
        });
    }

    async function handleUnlock(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLocalError("");

        try {
            const details = await onLoad(passenger, passportSeries, passportNumber);

            setForm({
                firstName: details.firstName,
                lastName: details.lastName,
                patronymic: details.patronymic ?? "",
                passportSeries: details.passportSeries,
                passportNumber: details.passportNumber,
                email: details.email ?? "",
                birthDate: details.birthDate ?? "",
                registrationAddress: details.registrationAddress ?? "",
                actualAddress: details.actualAddress ?? "",
                phoneNumber: details.phoneNumber ?? "",
                taxpayerId: details.taxpayerId ?? "",
                bankName: details.bankName ?? "",
                currentAccountNumber: details.currentAccountNumber ?? "",
                correspondentAccountNumber: details.correspondentAccountNumber ?? "",
                bankIdentifierCode: details.bankIdentifierCode ?? ""
            });
        } catch (error) {
            setLocalError(error instanceof Error
                ? error.message
                : "Не удалось открыть карточку пассажира.");
        }
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (form === null) {
            return;
        }

        setLocalError("");

        try {
            await onSubmit(passenger, passportSeries, passportNumber, form);
        } catch (error) {
            setLocalError(error instanceof Error
                ? error.message
                : "Не удалось сохранить данные пассажира.");
        }
    }

    return (
        <div className="management-modal-backdrop" role="presentation" onMouseDown={onClose}>
            <form
                className="management-passenger-modal"
                onSubmit={form === null ? handleUnlock : handleSubmit}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="management-passenger-modal-header">
                    <div>
                        <h3>Редактирование пассажира</h3>
                        <span>{passenger.fullName}</span>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Закрыть">
                        ×
                    </button>
                </div>

                {form === null ? (
                    <>
                        <p className="management-passenger-modal-note">
                            Подтвердите текущий паспорт. После этого откроется форма изменения данных.
                        </p>
                        <div className="management-passenger-modal-grid compact">
                            <InputField
                                label="Серия паспорта"
                                value={passportSeries}
                                onChange={(value) => setPassportSeries(value.replace(/\D/g, "").slice(0, 4))}
                                maxLength={4}
                                required
                            />
                            <InputField
                                label="Номер паспорта"
                                value={passportNumber}
                                onChange={(value) => setPassportNumber(value.replace(/\D/g, "").slice(0, 6))}
                                maxLength={6}
                                required
                            />
                        </div>
                    </>
                ) : (
                    <div className="management-passenger-modal-grid">
                        <InputField
                            label="Фамилия"
                            value={form.lastName}
                            onChange={(value) => updateField("lastName", value)}
                            required
                        />
                        <InputField
                            label="Имя"
                            value={form.firstName}
                            onChange={(value) => updateField("firstName", value)}
                            required
                        />
                        <InputField
                            label="Отчество"
                            value={form.patronymic ?? ""}
                            onChange={(value) => updateField("patronymic", value)}
                        />
                        <InputField
                            label="Серия паспорта"
                            value={form.passportSeries}
                            onChange={(value) => updateField("passportSeries", value.replace(/\D/g, "").slice(0, 4))}
                            maxLength={4}
                            required
                        />
                        <InputField
                            label="Номер паспорта"
                            value={form.passportNumber}
                            onChange={(value) => updateField("passportNumber", value.replace(/\D/g, "").slice(0, 6))}
                            maxLength={6}
                            required
                        />
                        <InputField
                            label="Почта для уведомлений"
                            value={form.email ?? ""}
                            onChange={(value) => updateField("email", value)}
                            type="email"
                        />
                        <InputField
                            label="Дата рождения"
                            value={form.birthDate ?? ""}
                            onChange={(value) => updateField("birthDate", value)}
                            type="date"
                        />
                    </div>
                )}

                {localError !== "" && (
                    <div className="management-inline-error">{localError}</div>
                )}

                <div className="management-passenger-modal-actions">
                    <button
                        type="button"
                        className="management-secondary-button"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        Отмена
                    </button>
                    <button
                        type="submit"
                        className="management-primary-button"
                        disabled={isLoading}
                    >
                        {form === null ? "Открыть карточку" : "Сохранить"}
                    </button>
                </div>
            </form>
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
    canEdit,
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
    canEdit: boolean;
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

                {!canEdit ? (
                    <LockedAirportCard
                        point={rightPoint}
                        invalid={isInvalid}
                    />
                ) : isLastLeg ? (
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

                {canEdit && !isLastLeg && (
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
                ↻
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

function InfoCell({ label, value, isWarning = false }: { label: string; value: string; isWarning?: boolean }) {
    return (
        <div className="management-info-block">
            <span>{label}</span>
            <strong className={isWarning ? "management-date-warning" : undefined}>{value}</strong>
        </div>
    );
}

function EditableInfoCell({
    label,
    value,
    min,
    isWarning = false,
    onChange
}: {
    label: string;
    value: string;
    min?: string;
    isWarning?: boolean;
    onChange: (value: string) => void;
}) {
    return (
        <label className="management-info-block management-info-block-editable">
            <span>{label}</span>
            <input
                className={isWarning ? "management-date-warning" : undefined}
                type="datetime-local"
                value={value}
                min={min}
                onChange={(event) => onChange(event.target.value)}
            />
        </label>
    );
}

function RouteCandidateChooser({
    activeRouteChoice,
    candidatesCount,
    onAirportSelect,
    onAddIntermediatePoint,
    onRemoveIntermediatePoint,
    onSegmentChange,
    onElementChange
}: {
    activeRouteChoice: ActiveRouteChoice | null;
    candidatesCount: number;
    onAirportSelect: (
        routePointIndex: number,
        airportId: string,
        displayName: string,
        airport: AirportSearchResponse
    ) => void;
    onAddIntermediatePoint: (rightPointIndex: number) => void;
    onRemoveIntermediatePoint: (rightPointIndex: number) => void;
    onSegmentChange: (direction: -1 | 1) => void;
    onElementChange: (element: HTMLDivElement | null) => void;
}) {
    if (activeRouteChoice === null) {
        return (
            <div className="management-route-candidate-chooser" ref={onElementChange}>
                <span className="management-route-candidate-hint">
                    Нажмите + рядом с аэропортом, чтобы выбрать участок для подбора вариантов.
                </span>
            </div>
        );
    }

    const helperText = `Варианты на карте считаются для участка ${activeRouteChoice.leftPoint.displayName} -> ${activeRouteChoice.rightPoint.displayName}`;
    const canGoBack = activeRouteChoice.segmentNumber > 1;
    const canGoForward = activeRouteChoice.segmentNumber < activeRouteChoice.segmentCount;
    const candidateText = activeRouteChoice.canEditRightPoint
        ? candidatesCount > 0
            ? `На карте: ${candidatesCount} вариантов`
            : "Выберите предложенный аэропорт на карте"
        : "Аэропорт прибытия зафиксирован";

    return (
        <div className="management-route-candidate-chooser active" ref={onElementChange}>
            <div className="management-route-candidate-hint">
                <span>{helperText}</span>
                <span>{candidateText}</span>
            </div>

            <div className="management-route-candidate-row">
                <button
                    type="button"
                    className="management-route-segment-button"
                    onClick={() => onSegmentChange(-1)}
                    disabled={!canGoBack}
                    title="Предыдущий участок"
                >
                    {"<"}
                </button>

                <LockedAirportCard point={activeRouteChoice.leftPoint} />

                <div className="management-route-segment-counter">
                    Участок {activeRouteChoice.segmentNumber} из {activeRouteChoice.segmentCount}
                </div>

                {activeRouteChoice.canEditRightPoint ? (
                    <AirportSearch
                        label=""
                        selectedAirportId={activeRouteChoice.rightPoint.airportId?.toString() ?? ""}
                        selectedAirportDisplayName={activeRouteChoice.rightPoint.displayName}
                        onSelect={(airport) =>
                            onAirportSelect(
                                activeRouteChoice.rightPointIndex,
                                airport.id,
                                airport.displayName,
                                airport.airport
                            )
                        }
                    />
                ) : (
                    <LockedAirportCard point={activeRouteChoice.rightPoint} />
                )}

                <div className="management-route-candidate-actions">
                    <button
                        type="button"
                        className="management-route-segment-button"
                        onClick={() => onAddIntermediatePoint(activeRouteChoice.rightPointIndex)}
                        title="Добавить промежуточный аэропорт"
                    >
                        +
                    </button>

                    <button
                        type="button"
                        className="management-route-segment-button management-route-remove-point"
                        onClick={() => onRemoveIntermediatePoint(activeRouteChoice.rightPointIndex)}
                        disabled={!activeRouteChoice.canRemoveRightPoint}
                        title="Удалить промежуточный аэропорт"
                    >
                        −
                    </button>
                </div>

                <button
                    type="button"
                    className="management-route-segment-button"
                    onClick={() => onSegmentChange(1)}
                    disabled={!canGoForward}
                    title="Следующий участок"
                >
                    {">"}
                </button>
            </div>

        </div>
    );
}

const defaultMapCenter: Coordinate = [55.751244, 37.618423];

function getActiveCandidatePointIndex(
    routePoints: RoutePoint[],
    activeCandidatePointIndex: number | null
): number | null {
    if (routePoints.length < 2) {
        return null;
    }

    if (
        activeCandidatePointIndex !== null &&
        activeCandidatePointIndex > 0 &&
        activeCandidatePointIndex < routePoints.length
    ) {
        return activeCandidatePointIndex;
    }

    return 1;
}

function createActiveRouteChoice(
    routePoints: RoutePoint[],
    activeCandidatePointIndex: number | null
): ActiveRouteChoice | null {
    if (
        activeCandidatePointIndex === null ||
        activeCandidatePointIndex <= 0 ||
        activeCandidatePointIndex >= routePoints.length
    ) {
        return null;
    }

    return {
        leftPoint: routePoints[activeCandidatePointIndex - 1],
        rightPoint: routePoints[activeCandidatePointIndex],
        rightPointIndex: activeCandidatePointIndex,
        segmentNumber: activeCandidatePointIndex,
        segmentCount: routePoints.length - 1,
        canEditRightPoint: activeCandidatePointIndex < routePoints.length - 1,
        canRemoveRightPoint: activeCandidatePointIndex < routePoints.length - 1
    };
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

function areNumberArraysEqual(left: number[], right: number[]): boolean {
    if (left.length !== right.length) {
        return false;
    }

    const sortedLeft = [...left].sort((a, b) => a - b);
    const sortedRight = [...right].sort((a, b) => a - b);

    return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function compareEmployeesForAssignment(
    leftEmployee: AirlineEmployeeResponse,
    rightEmployee: AirlineEmployeeResponse,
    selectedEmployeeIds: Set<number>
): number {
    const leftSelectedRank = selectedEmployeeIds.has(leftEmployee.id) ? 0 : 1;
    const rightSelectedRank = selectedEmployeeIds.has(rightEmployee.id) ? 0 : 1;

    if (leftSelectedRank !== rightSelectedRank) {
        return leftSelectedRank - rightSelectedRank;
    }

    const roleRankDifference = getEmployeeRoleRank(leftEmployee.roleName) -
        getEmployeeRoleRank(rightEmployee.roleName);

    if (roleRankDifference !== 0) {
        return roleRankDifference;
    }

    const leftName = leftEmployee.fullName || leftEmployee.email;
    const rightName = rightEmployee.fullName || rightEmployee.email;

    return leftName.localeCompare(rightName, "ru");
}

function getEmployeeRoleRank(roleName: string): number {
    switch (roleName) {
        case "Employee":
            return 0;

        case "Manager":
            return 1;

        case "GeneralDirector":
            return 2;

        case "Owner":
            return 3;

        default:
            return 4;
    }
}
