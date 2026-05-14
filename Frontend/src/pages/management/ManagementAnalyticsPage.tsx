import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Header from "../../components/header/Header";
import { getManagementDepartures } from "../../api/managementService";
import { hasManagementAccess } from "../../api/utils/roleAccess";
import { useUser } from "../../context/UserContext";
import type { ManagementDepartureResponse } from "../../contracts/responses/departures/managementDepartureResponse";
import { ManagementSidebar } from "./ManagementPlanesPage";
import "./ManagementPage.css";
import "./ManagementAnalyticsPage.css";

type PeriodKey = "sevenDays" | "month" | "sixMonths" | "year" | "all" | "custom";

interface RouteStat {
    key: string;
    title: string;
    count: number;
    revenue: number;
}

const landedStatusId = 14;
const cancelledStatusId = 17;
const deniedStatusId = 18;
const approvedStatusIds = new Set([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19, 20, 21]);
const rejectedStatusIds = new Set([cancelledStatusId, deniedStatusId]);

const periodOptions: Array<{ key: PeriodKey; label: string }> = [
    { key: "sevenDays", label: "7 дней" },
    { key: "month", label: "Месяц" },
    { key: "sixMonths", label: "6 месяцев" },
    { key: "year", label: "Год" },
    { key: "all", label: "Всё время" },
    { key: "custom", label: "Диапазон" }
];

export default function ManagementAnalyticsPage() {
    const navigate = useNavigate();
    const { user, isLoading: isUserLoading } = useUser();
    const [departures, setDepartures] = useState<ManagementDepartureResponse[]>([]);
    const [period, setPeriod] = useState<PeriodKey>("sevenDays");
    const [customDateFrom, setCustomDateFrom] = useState("");
    const [customDateTo, setCustomDateTo] = useState("");
    const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    const loadAnalytics = useCallback(async (signal?: AbortSignal) => {
        setIsAnalyticsLoading(true);
        setErrorMessage("");

        try {
            const [orders, flights, completed] = await Promise.all([
                getManagementDepartures("orders", signal),
                getManagementDepartures("flights", signal),
                getManagementDepartures("completed", signal)
            ]);

            setDepartures(getUniqueDepartures([...orders, ...flights, ...completed]));
        } catch {
            if (!signal?.aborted) {
                setErrorMessage("Не удалось загрузить аналитику.");
            }
        } finally {
            if (!signal?.aborted) {
                setIsAnalyticsLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        if (isUserLoading || user === null || !hasManagementAccess(user.role?.name)) {
            return;
        }

        const abortController = new AbortController();
        loadAnalytics(abortController.signal);

        return () => abortController.abort();
    }, [isUserLoading, loadAnalytics, user]);

    const analytics = useMemo(
        () => buildAnalytics(departures, period, customDateFrom, customDateTo),
        [customDateFrom, customDateTo, departures, period]
    );

    if (!isUserLoading && (user === null || !hasManagementAccess(user.role?.name))) {
        return <Navigate to="/catalog" replace />;
    }

    const showLoading = isUserLoading || isAnalyticsLoading;

    return (
        <div className="catalog-wrapper">
            <Header showSearch={false}>
                <button className="header-icon-btn" onClick={() => navigate("/catalog")} title="Назад">
                    <svg viewBox="0 0 24 24">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                </button>
            </Header>

            <div className="catalog-layout">
                <ManagementSidebar
                    email={user?.email}
                    roleName={user?.role?.name}
                    isUserLoading={isUserLoading}
                />

                <main className="catalog-main management-analytics-page">
                    <div className="management-analytics-header">
                        <div>
                            <h1>Аналитика компании</h1>
                            <p>Занятость мест, заявки, доход и популярные направления.</p>
                        </div>

                        <div className="management-analytics-periods" aria-label="Период аналитики">
                            {periodOptions.map((option) => (
                                <button
                                    key={option.key}
                                    type="button"
                                    className={period === option.key ? "active" : ""}
                                    onClick={() => setPeriod(option.key)}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {period === "custom" && (
                        <div className="management-analytics-custom-period">
                            <label>
                                <span>С</span>
                                <input
                                    type="date"
                                    value={customDateFrom}
                                    onChange={(event) => setCustomDateFrom(event.target.value)}
                                />
                            </label>
                            <label>
                                <span>По</span>
                                <input
                                    type="date"
                                    value={customDateTo}
                                    onChange={(event) => setCustomDateTo(event.target.value)}
                                />
                            </label>
                        </div>
                    )}

                    {errorMessage !== "" && (
                        <div className="management-inline-error">{errorMessage}</div>
                    )}

                    {showLoading ? (
                        <div className="management-empty-state">Загрузка аналитики...</div>
                    ) : departures.length === 0 ? (
                        <div className="management-empty-state">Данных для аналитики пока нет.</div>
                    ) : (
                        <>
                            <section className="management-analytics-summary compact" aria-label="Сводка">
                                <AnalyticsMetric label="Доход за период" value={formatPrice(analytics.revenue)} />
                                <AnalyticsMetric label="Одобрено заявок" value={analytics.approvedCount.toString()} />
                                <AnalyticsMetric label="Отклонено заявок" value={analytics.rejectedCount.toString()} />
                            </section>

                            <section className="management-analytics-grid">
                                <article className="management-analytics-panel wide">
                                    <div className="management-analytics-panel-header">
                                        <h2>ТОП популярных направлений</h2>
                                        <span>{analytics.topRoutes.length}</span>
                                    </div>
                                    <TopRoutesChart routes={analytics.topRoutes} />
                                </article>

                                <article className="management-analytics-panel">
                                    <div className="management-analytics-panel-header">
                                        <h2>Заявки</h2>
                                        <span>{analytics.approvedCount + analytics.rejectedCount}</span>
                                    </div>
                                    <RequestsChart
                                        approvedCount={analytics.approvedCount}
                                        rejectedCount={analytics.rejectedCount}
                                    />
                                </article>
                            </section>
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}

function AnalyticsMetric({ label, value }: { label: string; value: string }) {
    return (
        <div className="management-analytics-metric">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function RequestsChart({
    approvedCount,
    rejectedCount
}: {
    approvedCount: number;
    rejectedCount: number;
}) {
    const total = approvedCount + rejectedCount;
    const approvedPercent = total === 0 ? 0 : Math.round((approvedCount / total) * 100);
    const rejectedPercent = total === 0 ? 0 : 100 - approvedPercent;

    return (
        <div className="management-requests-chart">
            <div
                className="management-requests-ring"
                style={{ "--approved-percent": approvedPercent } as CSSProperties}
            >
                <span>{total}</span>
            </div>
            <div className="management-requests-legend">
                <div>
                    <span className="approved"></span>
                    <strong>{approvedCount}</strong>
                    <small>Одобрено, {approvedPercent}%</small>
                </div>
                <div>
                    <span className="rejected"></span>
                    <strong>{rejectedCount}</strong>
                    <small>Отклонено, {rejectedPercent}%</small>
                </div>
            </div>
        </div>
    );
}

function TopRoutesChart({ routes }: { routes: RouteStat[] }) {
    const maxCount = Math.max(1, ...routes.map((route) => route.count));

    if (routes.length === 0) {
        return <p className="management-analytics-empty">Нет направлений за выбранный период.</p>;
    }

    return (
        <div className="management-top-routes">
            {routes.map((route, index) => (
                <div key={route.key} className="management-top-route-row">
                    <span className="management-top-route-rank">{index + 1}</span>
                    <div className="management-top-route-main">
                        <div className="management-top-route-title-row">
                            <strong>{route.title}</strong>
                            <span>{route.count}</span>
                        </div>
                        <div className="management-top-route-track">
                            <div style={{ width: `${(route.count / maxCount) * 100}%` }}></div>
                        </div>
                        <small>{formatPrice(route.revenue)}</small>
                    </div>
                </div>
            ))}
        </div>
    );
}

function buildAnalytics(
    departures: ManagementDepartureResponse[],
    period: PeriodKey,
    customDateFrom: string,
    customDateTo: string
) {
    const filteredDepartures = departures.filter((departure) =>
        isInSelectedPeriod(departure.requestedTakeOffDateTime, period, customDateFrom, customDateTo)
    );
    const approvedDepartures = filteredDepartures.filter(isApprovedDeparture);
    const flownDepartures = filteredDepartures.filter((departure) => departure.currentStatusId === landedStatusId);

    return {
        revenue: flownDepartures.reduce((sum, departure) => sum + departure.price, 0),
        approvedCount: approvedDepartures.length,
        rejectedCount: filteredDepartures.filter(isRejectedDeparture).length,
        topRoutes: buildTopRoutes(approvedDepartures)
    };
}

function buildTopRoutes(departures: ManagementDepartureResponse[]): RouteStat[] {
    const routeMap = new Map<string, RouteStat>();

    for (const departure of departures) {
        const key = `${departure.takeOffAirportId}-${departure.landingAirportId}`;
        const title = `${getAirportShortName(
            departure.takeOffAirportCity,
            departure.takeOffAirportName,
            departure.takeOffAirportIata,
            departure.takeOffAirportIcao
        )} → ${getAirportShortName(
            departure.landingAirportCity,
            departure.landingAirportName,
            departure.landingAirportIata,
            departure.landingAirportIcao
        )}`;
        const current = routeMap.get(key) ?? { key, title, count: 0, revenue: 0 };

        current.count += 1;
        current.revenue += departure.price;
        routeMap.set(key, current);
    }

    return [...routeMap.values()]
        .sort((first, second) => second.count - first.count || second.revenue - first.revenue)
        .slice(0, 5);
}

function getUniqueDepartures(departures: ManagementDepartureResponse[]): ManagementDepartureResponse[] {
    return [...new Map(departures.map((departure) => [departure.id, departure])).values()];
}

function isApprovedDeparture(departure: ManagementDepartureResponse): boolean {
    if (isRejectedDeparture(departure)) {
        return false;
    }

    return departure.statusHistory.some((status) => approvedStatusIds.has(status.id)) ||
        approvedStatusIds.has(departure.currentStatusId);
}

function isRejectedDeparture(departure: ManagementDepartureResponse): boolean {
    return rejectedStatusIds.has(departure.currentStatusId) ||
        departure.statusHistory.some((status) => rejectedStatusIds.has(status.id));
}

function isInSelectedPeriod(
    value: string,
    period: PeriodKey,
    customDateFrom: string,
    customDateTo: string
): boolean {
    if (period === "all") {
        return true;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return false;
    }

    const today = new Date();
    const startDate = new Date(today);

    if (period === "custom") {
        return isInCustomDateRange(date, customDateFrom, customDateTo);
    }

    if (period === "sevenDays") {
        startDate.setDate(today.getDate() - 7);
    } else if (period === "month") {
        startDate.setMonth(today.getMonth() - 1);
    } else if (period === "year") {
        startDate.setFullYear(today.getFullYear() - 1);
    } else {
        startDate.setMonth(today.getMonth() - 6);
    }

    startDate.setHours(0, 0, 0, 0);

    return date >= startDate && date <= today;
}

function isInCustomDateRange(date: Date, customDateFrom: string, customDateTo: string): boolean {
    const startDate = customDateFrom === "" ? null : createDateBoundary(customDateFrom, false);
    const endDate = customDateTo === "" ? null : createDateBoundary(customDateTo, true);

    if (startDate !== null && date < startDate) {
        return false;
    }

    if (endDate !== null && date > endDate) {
        return false;
    }

    return true;
}

function createDateBoundary(value: string, isEndOfDay: boolean): Date | null {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    if (isEndOfDay) {
        date.setHours(23, 59, 59, 999);
    } else {
        date.setHours(0, 0, 0, 0);
    }

    return date;
}

function getAirportShortName(
    city?: string | null,
    name?: string | null,
    iata?: string | null,
    icao?: string | null
): string {
    const code = iata || icao;
    const title = city || name || "Аэропорт";

    return code ? `${title} (${code})` : title;
}

function formatPrice(value: number): string {
    return new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: "RUB",
        maximumFractionDigits: 0
    }).format(value);
}
