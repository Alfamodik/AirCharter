import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Header from "../../components/header/Header";
import { getManagementDepartures } from "../../api/managementService";
import { hasManagementAccess } from "../../api/utils/roleAccess";
import { useUser } from "../../context/UserContext";
import type { ManagementDepartureResponse } from "../../contracts/responses/departures/managementDepartureResponse";
import { ManagementSidebar } from "./ManagementPlanesPage";
import { isFlightBehindSchedule } from "./managementActionCounters";
import "./ManagementPage.css";
import "./ManagementAnalyticsPage.css";

type PeriodKey = "sevenDays" | "month" | "sixMonths" | "year" | "all" | "custom";

type DateRange = {
    currentStart: Date | null;
    currentEnd: Date | null;
    previousStart: Date | null;
    previousEnd: Date | null;
};

type DeltaValue = {
    text: string;
    tone: "positive" | "negative" | "neutral";
};

type MetricCardData = {
    key: string;
    label: string;
    value: string;
    detail: string;
    help: string;
    delta?: DeltaValue;
};

type FunnelStep = {
    key: string;
    label: string;
    count: number;
    percent: number;
    tone: "neutral" | "positive" | "warning" | "danger";
};

type TrendPoint = {
    key: string;
    label: string;
    requests: number;
    revenue: number;
};

type TrendGroup = "day" | "week" | "month" | "year";

type RankedStat = {
    key: string;
    title: string;
    count: number;
    value: number;
};

type IssueStat = {
    key: string;
    label: string;
    value: string;
    detail: string;
    tone: "danger" | "warning" | "neutral";
};

type PipelineStage = {
    key: string;
    label: string;
    count: number;
    value: number;
};

const inCreationStatusId = 1;
const awaitingApprovalStatusId = 2;
const landedStatusId = 14;
const delayedStatusId = 15;
const redirectedStatusId = 16;
const cancelledStatusId = 17;
const deniedStatusId = 18;
const awaitingContractStatusId = 19;
const awaitingPaymentStatusId = 20;
const intermediateStopStatusId = 21;

const approvedStatusIds = new Set([
    3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    landedStatusId,
    delayedStatusId,
    redirectedStatusId,
    awaitingContractStatusId,
    awaitingPaymentStatusId,
    intermediateStopStatusId
]);
const paidStatusIds = new Set([
    3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    landedStatusId,
    delayedStatusId,
    redirectedStatusId,
    intermediateStopStatusId
]);
const rejectedStatusIds = new Set([cancelledStatusId, deniedStatusId]);
const activeFlightStatusIds = new Set([
    3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    delayedStatusId,
    redirectedStatusId,
    intermediateStopStatusId
]);

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
    const [period, setPeriod] = useState<PeriodKey>("month");
    const [customDateFrom, setCustomDateFrom] = useState("");
    const [customDateTo, setCustomDateTo] = useState("");
    const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    const loadAnalytics = useCallback(async (signal?: AbortSignal) => {
        setIsAnalyticsLoading(true);
        setErrorMessage("");

        try {
            const response = await getManagementDepartures("analytics", signal);

            setDepartures(response);
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
                    <div className="management-analytics-period-panel">
                        <div className="management-analytics-header">
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
                    </div>

                    {errorMessage !== "" && (
                        <div className="management-inline-error">{errorMessage}</div>
                    )}

                    {showLoading ? (
                        <div className="management-empty-state">Загрузка аналитики...</div>
                    ) : departures.length === 0 ? (
                        <div className="management-empty-state">Данных для аналитики пока нет.</div>
                    ) : (
                        <>
                            <section className="management-analytics-summary" aria-label="Ключевые показатели">
                                {analytics.metrics.map((metric) => (
                                    <AnalyticsMetric key={metric.key} metric={metric} />
                                ))}
                            </section>

                            <section className="management-analytics-grid">
                                <article className="management-analytics-panel wide span-2">
                                    <div className="management-analytics-panel-header">
                                        <div>
                                            <h2>Воронка заявок</h2>
                                            <HelpTooltip text="Показывает, сколько заявок проходит каждый шаг: от создания до рейса. Проценты справа считаются от всех заявок, созданных за выбранный период. Потеряны - это отмененные или отклоненные заявки из этой же группы." />
                                            <p>Когорта считается по дате создания заявки за выбранный период.</p>
                                        </div>
                                        <span>{analytics.createdCount}</span>
                                    </div>
                                    <FunnelChart steps={analytics.funnelSteps} />
                                </article>

                                <article className="management-analytics-panel">
                                    <div className="management-analytics-panel-header">
                                        <div>
                                            <h2>Проблемы сейчас</h2>
                                            <HelpTooltip text="Это список мест, где менеджеру стоит посмотреть заявки руками: долгие ожидания, просрочки, рейсы не по расписанию и заявки без ответственного." />
                                            <p>Заявки и рейсы, которые требуют внимания.</p>
                                        </div>
                                        <span>{analytics.issueTotal}</span>
                                    </div>
                                    <IssueList issues={analytics.issues} />
                                </article>

                                <article className="management-analytics-panel wide full">
                                    <div className="management-analytics-panel-header">
                                        <div>
                                            <h2>Динамика</h2>
                                            <HelpTooltip text="Помогает понять, растёт ли поток заявок и денег. За 7 дней показывает дни, за месяц - недели, за длинные периоды - более крупные интервалы. Оранжевое - заявки, зелёное - выручка." />
                                            <p>Поданные заявки и выручка выполненных рейсов.</p>
                                        </div>
                                        <span>{analytics.trend.length}</span>
                                    </div>
                                    <TrendChart points={analytics.trend} />
                                </article>

                                <article className="management-analytics-panel">
                                    <div className="management-analytics-panel-header">
                                        <div>
                                            <h2>Деньги в работе</h2>
                                            <HelpTooltip text="Это сумма активных заявок, которые ещё не завершены и не потеряны. По сути, деньги, которые сейчас можно довести до сделки." />
                                            <p>Текущие незавершённые заявки без черновиков.</p>
                                        </div>
                                        <span>{formatPrice(analytics.pipelineValue)}</span>
                                    </div>
                                    <PipelineList stages={analytics.pipelineStages} />
                                </article>

                                <article className="management-analytics-panel">
                                    <div className="management-analytics-panel-header">
                                        <div>
                                            <h2>Самолёты</h2>
                                            <HelpTooltip text="Показывает, какие самолёты чаще выбирают в заявках. Это помогает понять спрос на конкретные модели и вместимость." />
                                            <p>Какие борта чаще выбирают в заявках.</p>
                                        </div>
                                        <span>{analytics.topPlanes.length}</span>
                                    </div>
                                    <RankedList stats={analytics.topPlanes} valueLabel="сумма заявок" />
                                </article>

                                <article className="management-analytics-panel wide">
                                    <div className="management-analytics-panel-header">
                                        <div>
                                            <h2>Спрос по маршрутам</h2>
                                            <HelpTooltip text="Показывает, какие направления чаще всего запрашивают клиенты и какую сумму эти заявки потенциально приносят." />
                                            <p>Поданные заявки за выбранный период.</p>
                                        </div>
                                        <span>{analytics.topRoutes.length}</span>
                                    </div>
                                    <RankedList stats={analytics.topRoutes} valueLabel="потенциал" />
                                </article>
                            </section>
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}

function AnalyticsMetric({ metric }: { metric: MetricCardData }) {
    return (
        <div className="management-analytics-metric">
            <span className="management-metric-label">
                {metric.label}
                <HelpTooltip text={metric.help} />
            </span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
            {metric.delta && (
                <em className={`management-analytics-delta ${metric.delta.tone}`}>
                    {metric.delta.text}
                </em>
            )}
        </div>
    );
}

function HelpTooltip({ text }: { text: string }) {
    return (
        <span className="management-help-tooltip">
            <button type="button" className="management-help-icon" aria-label={text}>?</button>
            <span className="management-help-popup" role="tooltip">{text}</span>
        </span>
    );
}

function FunnelChart({ steps }: { steps: FunnelStep[] }) {
    return (
        <div className="management-funnel-list">
            {steps.map((step, index) => (
                <div key={step.key} className="management-funnel-row">
                    <span className="management-funnel-index">{index + 1}</span>
                    <div className="management-funnel-main">
                        <div className="management-funnel-title">
                            <strong>{step.label}</strong>
                            <span>{step.count}</span>
                        </div>
                        <div className="management-funnel-track">
                            <div
                                className={step.tone}
                                style={{ width: `${Math.max(3, step.percent)}%` }}
                            ></div>
                        </div>
                    </div>
                    <small title={`${step.percent}% от созданных заявок`}>{step.percent}%</small>
                </div>
            ))}
        </div>
    );
}

function IssueList({ issues }: { issues: IssueStat[] }) {
    return (
        <div className="management-issue-list">
            {issues.map((issue) => (
                <div key={issue.key} className={`management-issue-row ${issue.tone}`}>
                    <div>
                        <strong>{issue.label}</strong>
                        <span>{issue.detail}</span>
                    </div>
                    <b>{issue.value}</b>
                </div>
            ))}
        </div>
    );
}

function TrendChart({ points }: { points: TrendPoint[] }) {
    const maxRevenue = Math.max(1, ...points.map((point) => point.revenue));
    const maxRequests = Math.max(1, ...points.map((point) => point.requests));

    if (points.length === 0) {
        return <p className="management-analytics-empty">Нет данных за выбранный период.</p>;
    }

    return (
        <div
            className="management-trend-chart"
            style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}
        >
            {points.map((point) => (
                <div key={point.key} className="management-trend-column">
                    <div className="management-trend-bars">
                        <div
                            className="management-trend-bar revenue"
                            style={{ height: `${Math.max(6, (point.revenue / maxRevenue) * 100)}%` }}
                            title={`${point.label}: ${formatPrice(point.revenue)}`}
                        >
                            <span>{formatCompactMoney(point.revenue)}</span>
                        </div>
                        <div
                            className="management-trend-bar requests"
                            style={{ height: `${Math.max(6, (point.requests / maxRequests) * 100)}%` }}
                            title={`${point.label}: ${point.requests} заявок`}
                        >
                            <span>{point.requests}</span>
                        </div>
                    </div>
                    <strong>{point.label}</strong>
                </div>
            ))}
        </div>
    );
}

function PipelineList({ stages }: { stages: PipelineStage[] }) {
    const maxValue = Math.max(1, ...stages.map((stage) => stage.value));

    if (stages.every((stage) => stage.count === 0)) {
        return <p className="management-analytics-empty">Активных денег в работе нет.</p>;
    }

    return (
        <div className="management-pipeline-list">
            {stages.map((stage) => (
                <div key={stage.key} className="management-pipeline-row">
                    <div className="management-pipeline-title">
                        <strong>{stage.label}</strong>
                        <span>{stage.count}</span>
                    </div>
                    <div className="management-pipeline-track">
                        <div style={{ width: `${Math.max(3, (stage.value / maxValue) * 100)}%` }}></div>
                    </div>
                    <small>{formatPrice(stage.value)}</small>
                </div>
            ))}
        </div>
    );
}

function RankedList({ stats, valueLabel }: { stats: RankedStat[]; valueLabel: string }) {
    const maxCount = Math.max(1, ...stats.map((stat) => stat.count));

    if (stats.length === 0) {
        return <p className="management-analytics-empty">Данных за выбранный период нет.</p>;
    }

    return (
        <div className="management-ranked-list">
            {stats.map((stat, index) => (
                <div key={stat.key} className="management-ranked-row">
                    <span className="management-ranked-index">{index + 1}</span>
                    <div className="management-ranked-main">
                        <div className="management-ranked-title">
                            <strong>{stat.title}</strong>
                            <span>{stat.count}</span>
                        </div>
                        <div className="management-ranked-track">
                            <div style={{ width: `${(stat.count / maxCount) * 100}%` }}></div>
                        </div>
                        <small>{valueLabel}: {formatPrice(stat.value)}</small>
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
    const range = createDateRange(period, customDateFrom, customDateTo);
    const now = new Date();
    const createdInPeriod = filterByDate(departures, range, getCreatedDate);
    const previousCreated = filterByPreviousDate(departures, range, getCreatedDate);
    const submittedInPeriod = filterByDate(departures, range, getSubmittedDate);
    const approvedInPeriod = filterByDate(departures, range, getApprovalDate);
    const previousApproved = filterByPreviousDate(departures, range, getApprovalDate);
    const completedInPeriod = filterByDate(departures, range, getCompletedDate);
    const previousCompleted = filterByPreviousDate(departures, range, getCompletedDate);
    const rejectedInPeriod = filterByDate(departures, range, getRejectedDate);
    const previousRejected = filterByPreviousDate(departures, range, getRejectedDate);

    const createdSubmitted = createdInPeriod.filter(hasSubmitted);
    const createdApproved = createdInPeriod.filter(isApprovedDeparture);
    const createdPaid = createdInPeriod.filter(isPaidDeparture);
    const createdCompleted = createdInPeriod.filter(isCompletedDeparture);
    const createdRejected = createdInPeriod.filter(isRejectedDeparture);
    const previousCreatedSubmitted = previousCreated.filter(hasSubmitted);
    const previousCreatedApproved = previousCreated.filter(isApprovedDeparture);
    const previousCreatedCompleted = previousCreated.filter(isCompletedDeparture);
    const activePipeline = departures.filter(isPipelineDeparture);
    const draftDepartures = departures.filter((departure) => departure.currentStatusId === inCreationStatusId);
    const revenue = completedInPeriod.reduce(sumPrice, 0);
    const previousRevenue = previousCompleted.reduce(sumPrice, 0);
    const averageCheck = average(approvedInPeriod.map((departure) => departure.price));
    const previousAverageCheck = average(previousApproved.map((departure) => departure.price));
    const approvalConversion = ratio(createdApproved.length, Math.max(1, createdSubmitted.length));
    const previousApprovalConversion = ratio(previousCreatedApproved.length, Math.max(1, previousCreatedSubmitted.length));
    const completionConversion = ratio(createdCompleted.length, Math.max(1, createdSubmitted.length));
    const previousCompletionConversion = ratio(previousCreatedCompleted.length, Math.max(1, previousCreatedSubmitted.length));
    const repeatCustomers = countRepeatCustomers(submittedInPeriod, departures);
    const occupancy = averageOccupancy(approvedInPeriod.length > 0 ? approvedInPeriod : submittedInPeriod);
    const averageDecisionHours = averageDecisionDurationHours(submittedInPeriod);
    const pipelineValue = activePipeline.reduce(sumPrice, 0);

    return {
        metrics: [
            {
                key: "created",
                label: "Новые заявки",
                value: formatNumber(createdInPeriod.length),
                detail: `${formatNumber(submittedInPeriod.length)} подано за период`,
                help: "Сколько заявок появилось за выбранный период. Внутри учитываются и черновики, поэтому видно не только продажи, но и интерес клиентов.",
                delta: createCountDelta(createdInPeriod.length, previousCreated.length)
            },
            {
                key: "revenue",
                label: "Выручка рейсов",
                value: formatPrice(revenue),
                detail: `${formatNumber(completedInPeriod.length)} выполнено`,
                help: "Деньги только по рейсам, которые уже выполнены. Это не обещанная сумма, а фактически дошедшие до результата заказы.",
                delta: createCountDelta(revenue, previousRevenue)
            },
            {
                key: "pipeline",
                label: "Pipeline сейчас",
                value: formatPrice(pipelineValue),
                detail: `${formatNumber(activePipeline.length)} активных заявок`,
                help: "Сумма заявок, которые сейчас ещё в работе: ждут решения, договора, оплаты или выполнения рейса."
            },
            {
                key: "approvalConversion",
                label: "Конверсия в одобрение",
                value: formatPercent(approvalConversion),
                detail: `${formatNumber(createdApproved.length)} из ${formatNumber(createdSubmitted.length)} поданных`,
                help: "Доля поданных клиентами заявок, которые компания одобрила. Если показатель падает, возможно, заявки плохого качества или не хватает подходящих условий.",
                delta: createPointDelta(approvalConversion, previousApprovalConversion)
            },
            {
                key: "completionConversion",
                label: "Конверсия в рейс",
                value: formatPercent(completionConversion),
                detail: `${formatNumber(createdCompleted.length)} выполнено из когорты`,
                help: "Сколько заявок из выбранного периода реально дошли до выполненного рейса. Это один из главных показателей качества продаж.",
                delta: createPointDelta(completionConversion, previousCompletionConversion)
            },
            {
                key: "averageCheck",
                label: "Средний чек",
                value: formatPrice(averageCheck),
                detail: "по одобренным заявкам",
                help: "Средняя сумма одобренной заявки. Помогает понять, растут ли сделки по размеру, а не только по количеству.",
                delta: createCountDelta(averageCheck, previousAverageCheck)
            },
            {
                key: "repeatCustomers",
                label: "Повторные клиенты",
                value: formatNumber(repeatCustomers),
                detail: `${formatPercent(ratio(repeatCustomers, Math.max(1, submittedInPeriod.length)))} от поданных`,
                help: "Клиенты, у которых уже были заявки раньше. Чем выше доля повторных, тем меньше бизнес зависит от случайного нового трафика."
            },
            {
                key: "occupancy",
                label: "Загрузка мест",
                value: formatPercent(occupancy),
                detail: "пассажиры к вместимости",
                help: "Показывает, насколько заполнены выбранные самолёты пассажирами. Низкое значение может означать, что клиентам предлагают слишком большой борт."
            },
            {
                key: "decisionSpeed",
                label: "Реакция менеджера",
                value: formatDurationHours(averageDecisionHours),
                detail: "подача заявки до решения",
                help: "Сколько в среднем проходит от подачи заявки до решения: одобрения, отказа или следующего серьёзного этапа. Чем быстрее, тем лучше для продаж."
            }
        ] satisfies MetricCardData[],
        createdCount: createdInPeriod.length,
        pipelineValue,
        funnelSteps: buildFunnelSteps(
            createdInPeriod.length,
            createdSubmitted.length,
            createdApproved.length,
            createdPaid.length,
            createdCompleted.length,
            createdRejected.length
        ),
        issueTotal: buildIssueStats(departures, now, draftDepartures).reduce((sum, issue) => sum + Number(issue.value), 0),
        issues: buildIssueStats(departures, now, draftDepartures),
        trend: buildTrend(departures, range, period),
        pipelineStages: buildPipelineStages(activePipeline),
        topRoutes: buildTopRoutes(submittedInPeriod),
        topPlanes: buildTopPlanes(submittedInPeriod),
        rejectedCount: rejectedInPeriod.length,
        previousRejectedCount: previousRejected.length
    };
}

function createDateRange(period: PeriodKey, customDateFrom: string, customDateTo: string): DateRange {
    const now = new Date();

    if (period === "all") {
        return {
            currentStart: null,
            currentEnd: null,
            previousStart: null,
            previousEnd: null
        };
    }

    if (period === "custom") {
        const currentStart = customDateFrom === "" ? null : createDateBoundary(customDateFrom, false);
        const currentEnd = customDateTo === "" ? now : createDateBoundary(customDateTo, true) ?? now;
        const previousRange = createPreviousRange(currentStart, currentEnd);

        return {
            currentStart,
            currentEnd,
            previousStart: previousRange?.start ?? null,
            previousEnd: previousRange?.end ?? null
        };
    }

    const currentStart = new Date(now);

    if (period === "sevenDays") {
        currentStart.setDate(now.getDate() - 6);
    } else if (period === "month") {
        currentStart.setMonth(now.getMonth() - 1);
    } else if (period === "year") {
        currentStart.setFullYear(now.getFullYear() - 1);
    } else {
        currentStart.setMonth(now.getMonth() - 6);
    }

    currentStart.setHours(0, 0, 0, 0);

    const previousRange = createPreviousRange(currentStart, now);

    return {
        currentStart,
        currentEnd: now,
        previousStart: previousRange?.start ?? null,
        previousEnd: previousRange?.end ?? null
    };
}

function createPreviousRange(currentStart: Date | null, currentEnd: Date | null): { start: Date; end: Date } | null {
    if (currentStart === null || currentEnd === null) {
        return null;
    }

    const duration = currentEnd.getTime() - currentStart.getTime();

    if (duration <= 0) {
        return null;
    }

    const end = new Date(currentStart.getTime() - 1);
    const start = new Date(end.getTime() - duration);

    return { start, end };
}

function filterByDate(
    departures: ManagementDepartureResponse[],
    range: DateRange,
    dateSelector: (departure: ManagementDepartureResponse) => Date | null
): ManagementDepartureResponse[] {
    return departures.filter((departure) => isDateInRange(dateSelector(departure), range.currentStart, range.currentEnd));
}

function filterByPreviousDate(
    departures: ManagementDepartureResponse[],
    range: DateRange,
    dateSelector: (departure: ManagementDepartureResponse) => Date | null
): ManagementDepartureResponse[] {
    if (range.previousStart === null || range.previousEnd === null) {
        return [];
    }

    return departures.filter((departure) => isDateInRange(dateSelector(departure), range.previousStart, range.previousEnd));
}

function isDateInRange(date: Date | null, start: Date | null, end: Date | null): boolean {
    if (date === null) {
        return false;
    }

    if (start !== null && date < start) {
        return false;
    }

    if (end !== null && date > end) {
        return false;
    }

    return true;
}

function buildFunnelSteps(
    createdCount: number,
    submittedCount: number,
    approvedCount: number,
    paidCount: number,
    completedCount: number,
    rejectedCount: number
): FunnelStep[] {
    const baseCount = Math.max(1, createdCount);

    return [
        createFunnelStep("created", "Созданы", createdCount, baseCount, "neutral"),
        createFunnelStep("submitted", "Поданы клиентом", submittedCount, baseCount, "neutral"),
        createFunnelStep("approved", "Одобрены", approvedCount, baseCount, "positive"),
        createFunnelStep("paid", "Оплачены / в рейсе", paidCount, baseCount, "positive"),
        createFunnelStep("completed", "Выполнены", completedCount, baseCount, "positive"),
        createFunnelStep("rejected", "Потеряны", rejectedCount, baseCount, "danger")
    ];
}

function createFunnelStep(
    key: string,
    label: string,
    count: number,
    baseCount: number,
    tone: FunnelStep["tone"]
): FunnelStep {
    return {
        key,
        label,
        count,
        percent: Math.round((count / baseCount) * 100),
        tone
    };
}

function buildIssueStats(
    departures: ManagementDepartureResponse[],
    now: Date,
    draftDepartures: ManagementDepartureResponse[]
): IssueStat[] {
    const oldDrafts = draftDepartures.filter((departure) =>
        hoursBetween(getCreatedDate(departure), now) >= 24
    );
    const awaitingApproval = departures.filter((departure) =>
        departure.currentStatusId === awaitingApprovalStatusId
    );
    const longAwaitingApproval = awaitingApproval.filter((departure) =>
        hoursBetween(parseDate(departure.currentStatusSetAt), now) >= 2
    );
    const contractStuck = departures.filter((departure) =>
        departure.currentStatusId === awaitingContractStatusId &&
        hoursBetween(parseDate(departure.currentStatusSetAt), now) >= 24
    );
    const paymentStuck = departures.filter((departure) =>
        departure.currentStatusId === awaitingPaymentStatusId &&
        (
            isPaymentOverdue(departure, now) ||
            hoursBetween(parseDate(departure.currentStatusSetAt), now) >= 24
        )
    );
    const behindSchedule = departures.filter(isFlightBehindSchedule);
    const unassignedActive = departures.filter((departure) =>
        hasSubmitted(departure) &&
        !isFinalDeparture(departure) &&
        departure.employees.length === 0
    );

    return [
        {
            key: "oldDrafts",
            label: "Брошенные черновики",
            value: oldDrafts.length.toString(),
            detail: "созданы больше суток назад",
            tone: oldDrafts.length > 0 ? "warning" : "neutral"
        },
        {
            key: "awaitingApproval",
            label: "Ждут решения",
            value: awaitingApproval.length.toString(),
            detail: `${longAwaitingApproval.length} ждут больше 2 часов`,
            tone: longAwaitingApproval.length > 0 ? "danger" : awaitingApproval.length > 0 ? "warning" : "neutral"
        },
        {
            key: "contractStuck",
            label: "Застряли на договоре",
            value: contractStuck.length.toString(),
            detail: "больше суток без следующего шага",
            tone: contractStuck.length > 0 ? "warning" : "neutral"
        },
        {
            key: "paymentStuck",
            label: "Оплата под риском",
            value: paymentStuck.length.toString(),
            detail: "дедлайн прошёл или статус старше суток",
            tone: paymentStuck.length > 0 ? "danger" : "neutral"
        },
        {
            key: "behindSchedule",
            label: "Рейсы отстают",
            value: behindSchedule.length.toString(),
            detail: "статус ниже расчётного по времени",
            tone: behindSchedule.length > 0 ? "danger" : "neutral"
        },
        {
            key: "unassigned",
            label: "Без ответственного",
            value: unassignedActive.length.toString(),
            detail: "поданные активные заявки без сотрудников",
            tone: unassignedActive.length > 0 ? "warning" : "neutral"
        }
    ];
}

function buildTrend(
    departures: ManagementDepartureResponse[],
    range: DateRange,
    period: PeriodKey
): TrendPoint[] {
    const trendGroup = getTrendGroup(range, period);
    const trendMap = createTrendBuckets(range, trendGroup);

    for (const departure of departures) {
        const submittedDate = getSubmittedDate(departure);

        if (submittedDate !== null && isDateInRange(submittedDate, range.currentStart, range.currentEnd)) {
            const point = getTrendPoint(trendMap, submittedDate, trendGroup);
            point.requests += 1;
        }

        const completedDate = getCompletedDate(departure);

        if (completedDate !== null && isDateInRange(completedDate, range.currentStart, range.currentEnd)) {
            const point = getTrendPoint(trendMap, completedDate, trendGroup);
            point.revenue += departure.price;
        }
    }

    return [...trendMap.values()]
        .sort((first, second) => first.date.getTime() - second.date.getTime())
        .map((point) => ({
            key: point.key,
            label: point.label,
            requests: point.requests,
            revenue: point.revenue
        }));
}

function createTrendBuckets(
    range: DateRange,
    trendGroup: TrendGroup
): Map<string, TrendPoint & { date: Date }> {
    const trendMap = new Map<string, TrendPoint & { date: Date }>();

    if (range.currentStart === null || range.currentEnd === null) {
        return trendMap;
    }

    let cursor = getTrendBucketStart(range.currentStart, trendGroup);
    const end = getTrendBucketStart(range.currentEnd, trendGroup);

    while (cursor <= end) {
        getTrendPoint(trendMap, cursor, trendGroup);
        cursor = addTrendInterval(cursor, trendGroup);
    }

    return trendMap;
}

function getTrendPoint(
    trendMap: Map<string, TrendPoint & { date: Date }>,
    date: Date,
    trendGroup: TrendGroup
): TrendPoint & { date: Date } {
    const bucketDate = getTrendBucketStart(date, trendGroup);
    const key = createTrendKey(bucketDate, trendGroup);
    const current = trendMap.get(key);

    if (current !== undefined) {
        return current;
    }

    const point = {
        key,
        label: formatTrendLabel(bucketDate, trendGroup),
        requests: 0,
        revenue: 0,
        date: bucketDate
    };

    trendMap.set(key, point);

    return point;
}

function getTrendGroup(range: DateRange, period: PeriodKey): TrendGroup {
    if (period === "sevenDays") {
        return "day";
    }

    if (period === "month") {
        return "week";
    }

    if (period === "sixMonths" || period === "year") {
        return "month";
    }

    if (range.currentStart === null || range.currentEnd === null) {
        return "month";
    }

    const days = Math.ceil((range.currentEnd.getTime() - range.currentStart.getTime()) / 86_400_000);

    if (days <= 45) {
        return "day";
    }

    if (days <= 180) {
        return "week";
    }

    if (days <= 730) {
        return "month";
    }

    return "year";
}

function getTrendBucketStart(date: Date, trendGroup: TrendGroup): Date {
    if (trendGroup === "day") {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    if (trendGroup === "week") {
        const bucketDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dayIndex = (bucketDate.getDay() + 6) % 7;
        bucketDate.setDate(bucketDate.getDate() - dayIndex);

        return bucketDate;
    }

    if (trendGroup === "month") {
        return new Date(date.getFullYear(), date.getMonth(), 1);
    }

    return new Date(date.getFullYear(), 0, 1);
}

function addTrendInterval(date: Date, trendGroup: TrendGroup): Date {
    const nextDate = new Date(date);

    if (trendGroup === "day") {
        nextDate.setDate(nextDate.getDate() + 1);
    } else if (trendGroup === "week") {
        nextDate.setDate(nextDate.getDate() + 7);
    } else if (trendGroup === "month") {
        nextDate.setMonth(nextDate.getMonth() + 1);
    } else {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
    }

    return nextDate;
}

function createTrendKey(date: Date, trendGroup: TrendGroup): string {
    if (trendGroup === "year") {
        return date.getFullYear().toString();
    }

    if (trendGroup === "month") {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTrendLabel(date: Date, trendGroup: TrendGroup): string {
    if (trendGroup === "day") {
        return new Intl.DateTimeFormat("ru-RU", {
            day: "2-digit",
            month: "short"
        }).format(date);
    }

    if (trendGroup === "week") {
        return `с ${new Intl.DateTimeFormat("ru-RU", {
            day: "2-digit",
            month: "short"
        }).format(date)}`;
    }

    if (trendGroup === "month") {
        return new Intl.DateTimeFormat("ru-RU", {
            month: "short",
            year: "2-digit"
        }).format(date);
    }

    return date.getFullYear().toString();
}

function buildPipelineStages(activePipeline: ManagementDepartureResponse[]): PipelineStage[] {
    const stages: PipelineStage[] = [
        { key: "approval", label: "Ожидает решения", count: 0, value: 0 },
        { key: "contract", label: "Договор", count: 0, value: 0 },
        { key: "payment", label: "Оплата", count: 0, value: 0 },
        { key: "flight", label: "Рейс в работе", count: 0, value: 0 }
    ];
    const stageByKey = new Map(stages.map((stage) => [stage.key, stage]));

    for (const departure of activePipeline) {
        const stage = stageByKey.get(getPipelineStageKey(departure.currentStatusId));

        if (stage === undefined) {
            continue;
        }

        stage.count += 1;
        stage.value += departure.price;
    }

    return stages;
}

function buildTopRoutes(departures: ManagementDepartureResponse[]): RankedStat[] {
    const routeMap = new Map<string, RankedStat>();

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
        const current = routeMap.get(key) ?? { key, title, count: 0, value: 0 };

        current.count += 1;
        current.value += departure.price;
        routeMap.set(key, current);
    }

    return [...routeMap.values()]
        .sort((first, second) => second.count - first.count || second.value - first.value)
        .slice(0, 6);
}

function buildTopPlanes(departures: ManagementDepartureResponse[]): RankedStat[] {
    const planeMap = new Map<string, RankedStat>();

    for (const departure of departures) {
        const key = departure.planeModelName;
        const current = planeMap.get(key) ?? {
            key,
            title: departure.planeModelName,
            count: 0,
            value: 0
        };

        current.count += 1;
        current.value += departure.price;
        planeMap.set(key, current);
    }

    return [...planeMap.values()]
        .sort((first, second) => second.count - first.count || second.value - first.value)
        .slice(0, 6);
}

function countRepeatCustomers(
    periodDepartures: ManagementDepartureResponse[],
    allDepartures: ManagementDepartureResponse[]
): number {
    const submittedByRequester = new Map<string, number>();

    for (const departure of allDepartures) {
        if (!hasSubmitted(departure)) {
            continue;
        }

        const requesterKey = getRequesterKey(departure);
        submittedByRequester.set(requesterKey, (submittedByRequester.get(requesterKey) ?? 0) + 1);
    }

    return new Set(
        periodDepartures
            .map(getRequesterKey)
            .filter((requesterKey) => (submittedByRequester.get(requesterKey) ?? 0) > 1)
    ).size;
}

function averageOccupancy(departures: ManagementDepartureResponse[]): number {
    const occupancyValues = departures
        .filter((departure) => departure.planePassengerCapacity > 0)
        .map((departure) => departure.passengerCount / departure.planePassengerCapacity);

    return average(occupancyValues);
}

function averageDecisionDurationHours(departures: ManagementDepartureResponse[]): number {
    return average(
        departures
            .map((departure) => {
                const submittedAt = getSubmittedDate(departure);
                const decisionAt = getDecisionDate(departure);

                if (submittedAt === null || decisionAt === null || decisionAt < submittedAt) {
                    return null;
                }

                return (decisionAt.getTime() - submittedAt.getTime()) / 3_600_000;
            })
            .filter((value): value is number => value !== null)
    );
}

function getCreatedDate(departure: ManagementDepartureResponse): Date | null {
    return parseDate(departure.createdAt) ?? getFirstStatusDate(departure, [inCreationStatusId]);
}

function getSubmittedDate(departure: ManagementDepartureResponse): Date | null {
    return parseDate(departure.submittedAt) ?? getFirstStatusDate(departure, [awaitingApprovalStatusId]);
}

function getApprovalDate(departure: ManagementDepartureResponse): Date | null {
    return getFirstStatusDate(departure, [...approvedStatusIds]);
}

function getCompletedDate(departure: ManagementDepartureResponse): Date | null {
    return getFirstStatusDate(departure, [landedStatusId]);
}

function getRejectedDate(departure: ManagementDepartureResponse): Date | null {
    return getFirstStatusDate(departure, [...rejectedStatusIds]);
}

function getDecisionDate(departure: ManagementDepartureResponse): Date | null {
    return getFirstStatusDate(departure, [
        awaitingContractStatusId,
        deniedStatusId,
        awaitingPaymentStatusId,
        ...paidStatusIds
    ]);
}

function getFirstStatusDate(departure: ManagementDepartureResponse, statusIds: number[]): Date | null {
    const statusIdSet = new Set(statusIds);
    const statusDate = departure.statusHistory
        .filter((status) => statusIdSet.has(status.id))
        .map((status) => parseDate(status.setAt))
        .filter((date): date is Date => date !== null)
        .sort((first, second) => first.getTime() - second.getTime())[0];

    if (statusDate !== undefined) {
        return statusDate;
    }

    if (statusIdSet.has(departure.currentStatusId)) {
        return parseDate(departure.currentStatusSetAt);
    }

    return null;
}

function hasSubmitted(departure: ManagementDepartureResponse): boolean {
    return getSubmittedDate(departure) !== null || departure.currentStatusId !== inCreationStatusId;
}

function isApprovedDeparture(departure: ManagementDepartureResponse): boolean {
    if (isRejectedDeparture(departure)) {
        return false;
    }

    return getApprovalDate(departure) !== null;
}

function isPaidDeparture(departure: ManagementDepartureResponse): boolean {
    if (isRejectedDeparture(departure)) {
        return false;
    }

    return departure.statusHistory.some((status) => paidStatusIds.has(status.id)) ||
        paidStatusIds.has(departure.currentStatusId);
}

function isCompletedDeparture(departure: ManagementDepartureResponse): boolean {
    return departure.currentStatusId === landedStatusId ||
        departure.statusHistory.some((status) => status.id === landedStatusId);
}

function isRejectedDeparture(departure: ManagementDepartureResponse): boolean {
    return rejectedStatusIds.has(departure.currentStatusId) ||
        departure.statusHistory.some((status) => rejectedStatusIds.has(status.id));
}

function isFinalDeparture(departure: ManagementDepartureResponse): boolean {
    return isCompletedDeparture(departure) || isRejectedDeparture(departure);
}

function isPipelineDeparture(departure: ManagementDepartureResponse): boolean {
    if (departure.currentStatusId === inCreationStatusId || isFinalDeparture(departure)) {
        return false;
    }

    return departure.currentStatusId === awaitingApprovalStatusId ||
        departure.currentStatusId === awaitingContractStatusId ||
        departure.currentStatusId === awaitingPaymentStatusId ||
        activeFlightStatusIds.has(departure.currentStatusId);
}

function getPipelineStageKey(statusId: number): string {
    if (statusId === awaitingApprovalStatusId) {
        return "approval";
    }

    if (statusId === awaitingContractStatusId) {
        return "contract";
    }

    if (statusId === awaitingPaymentStatusId) {
        return "payment";
    }

    return "flight";
}

function isPaymentOverdue(departure: ManagementDepartureResponse, now: Date): boolean {
    const deadline = parseDate(departure.paymentDeadlineAt);

    return deadline !== null && deadline < now;
}

function getRequesterKey(departure: ManagementDepartureResponse): string {
    return departure.charterRequesterEmail.trim().toLowerCase();
}

function createCountDelta(current: number, previous: number): DeltaValue | undefined {
    if (previous === 0 && current === 0) {
        return undefined;
    }

    if (previous === 0) {
        return {
            text: "было 0 в прошлом периоде",
            tone: "positive"
        };
    }

    const percent = Math.round(((current - previous) / previous) * 100);

    return {
        text: `${percent > 0 ? "+" : ""}${percent}% к прошлому периоду`,
        tone: percent > 0 ? "positive" : percent < 0 ? "negative" : "neutral"
    };
}

function createPointDelta(current: number, previous: number): DeltaValue | undefined {
    if (previous === 0 && current === 0) {
        return undefined;
    }

    const points = Math.round((current - previous) * 100);

    return {
        text: `${points > 0 ? "+" : ""}${points} пунктов к прошлому периоду`,
        tone: points > 0 ? "positive" : points < 0 ? "negative" : "neutral"
    };
}

function sumPrice(sum: number, departure: ManagementDepartureResponse): number {
    return sum + departure.price;
}

function ratio(value: number, total: number): number {
    if (total <= 0) {
        return 0;
    }

    return value / total;
}

function average(values: number[]): number {
    if (values.length === 0) {
        return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function hoursBetween(start: Date | null, end: Date): number {
    if (start === null) {
        return 0;
    }

    return (end.getTime() - start.getTime()) / 3_600_000;
}

function parseDate(value?: string | null): Date | null {
    if (!value) {
        return null;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
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

function formatCompactMoney(value: number): string {
    return new Intl.NumberFormat("ru-RU", {
        notation: "compact",
        maximumFractionDigits: 1
    }).format(value);
}

function formatPercent(value: number): string {
    return new Intl.NumberFormat("ru-RU", {
        style: "percent",
        maximumFractionDigits: 0
    }).format(value);
}

function formatNumber(value: number): string {
    return new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: 0
    }).format(value);
}

function formatDurationHours(value: number): string {
    if (value <= 0) {
        return "нет данных";
    }

    if (value < 24) {
        return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value)} ч`;
    }

    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value / 24)} дн`;
}
