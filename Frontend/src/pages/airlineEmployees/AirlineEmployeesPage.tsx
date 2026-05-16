import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
    createMyAirlineEmployee,
    dismissMyAirlineEmployee,
    getMyAirlineEmployees,
    updateMyAirlineEmployeeRole,
    type AirlineEmployeeResponse
} from "../../api/airlineService";
import { getRoleRank, hasAirlineStaffAdministrationAccess } from "../../api/utils/roleAccess";
import Header from "../../components/header/Header";
import { useUser } from "../../context/UserContext";
import { ManagementSidebar } from "../management/ManagementPlanesPage";
import "./AirlineEmployeesPage.css";

const roleOptions = [
    { value: "Employee", label: "Сотрудник" },
    { value: "Manager", label: "Менеджер" },
    { value: "Admin", label: "Администратор" },
    { value: "GeneralDirector", label: "Генеральный директор" }
];

const roleLabels = new Map([
    ["Owner", "Owner"],
    ...roleOptions.map((role) => [role.value, role.label] as const)
]);

export default function AirlineEmployeesPage() {
    const navigate = useNavigate();
    const { user, isLoading: isUserLoading } = useUser();
    const [employees, setEmployees] = useState<AirlineEmployeeResponse[]>([]);
    const [email, setEmail] = useState("");
    const [roleName, setRoleName] = useState("Employee");
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [dismissCandidate, setDismissCandidate] = useState<AirlineEmployeeResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

    const canOpenPage = !isUserLoading &&
        Boolean(user?.airlineId) &&
        hasAirlineStaffAdministrationAccess(user?.role?.name);

    const availableRoleOptions = useMemo(
        () => roleOptions.filter((role) => getRoleRank(user?.role?.name) > getRoleRank(role.value)),
        [user?.role?.name]
    );

    useEffect(() => {
        if (!canOpenPage) {
            return;
        }

        void loadEmployees();
    }, [canOpenPage]);

    function openCreateModal() {
        setEmail("");
        setRoleName(availableRoleOptions[0]?.value ?? "Employee");
        setStatusMessage(null);
        setIsCreateModalOpen(true);
    }

    async function loadEmployees() {
        setIsLoading(true);
        setStatusMessage(null);

        try {
            const response = await getMyAirlineEmployees(undefined, true);
            setEmployees(response);
        } catch {
            setStatusMessage({ text: "Не удалось загрузить сотрудников.", type: "error" });
        } finally {
            setIsLoading(false);
        }
    }

    async function handleCreateEmployee(event: React.FormEvent) {
        event.preventDefault();

        if (isSaving) {
            return;
        }

        setIsSaving(true);
        setStatusMessage(null);

        try {
            const response = await createMyAirlineEmployee({
                email: email.trim(),
                roleName
            });

            if (response.employee) {
                setEmployees((currentEmployees) => sortEmployees([...currentEmployees, response.employee!]));
            }

            setIsCreateModalOpen(false);
            setEmail("");
            setRoleName(availableRoleOptions[0]?.value ?? "Employee");
            setStatusMessage({ text: response.message, type: "success" });
        } catch (error: unknown) {
            setStatusMessage({ text: getApiErrorMessage(error, "Не удалось создать сотрудника."), type: "error" });
        } finally {
            setIsSaving(false);
        }
    }

    async function handleRoleChange(employee: AirlineEmployeeResponse, nextRoleName: string) {
        if (isSaving || employee.roleName === nextRoleName) {
            return;
        }

        setIsSaving(true);
        setStatusMessage(null);

        try {
            const updatedEmployee = await updateMyAirlineEmployeeRole(employee.id, { roleName: nextRoleName });
            setEmployees((currentEmployees) =>
                sortEmployees(currentEmployees.map((currentEmployee) =>
                    currentEmployee.id === employee.id ? updatedEmployee : currentEmployee)));
        } catch (error: unknown) {
            setStatusMessage({ text: getApiErrorMessage(error, "Не удалось изменить статус сотрудника."), type: "error" });
        } finally {
            setIsSaving(false);
        }
    }

    async function handleDismissConfirm() {
        if (isSaving || dismissCandidate === null) {
            return;
        }

        setIsSaving(true);
        setStatusMessage(null);

        try {
            await dismissMyAirlineEmployee(dismissCandidate.id);
            setEmployees((currentEmployees) =>
                currentEmployees.filter((currentEmployee) => currentEmployee.id !== dismissCandidate.id));
            setDismissCandidate(null);
        } catch (error: unknown) {
            setStatusMessage({ text: getApiErrorMessage(error, "Не удалось уволить сотрудника."), type: "error" });
        } finally {
            setIsSaving(false);
        }
    }

    if (isUserLoading) {
        return <div className="auth-page"><div className="auth-title">Загрузка...</div></div>;
    }

    if (!canOpenPage) {
        return <Navigate to="/profile" replace />;
    }

    return (
        <div className="catalog-wrapper">
            <Header showSearch={false}>
                <button className="header-icon-btn" onClick={() => navigate(-1)} title="Назад">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

                <main className="catalog-main airline-employees-page">
                    <section className="airline-employees-panel">
                        <div className="airline-employees-heading">
                            <button
                                type="button"
                                className="auth-submit-button"
                                onClick={openCreateModal}
                                disabled={isSaving || availableRoleOptions.length === 0}
                            >
                                Пригласить сотрудника
                            </button>
                        </div>

                        {statusMessage && (
                            <div className={`form-message ${statusMessage.type}`}>{statusMessage.text}</div>
                        )}

                        {isLoading ? (
                            <div className="catalog-message">Загрузка...</div>
                        ) : employees.length === 0 ? (
                            <div className="catalog-message">Сотрудников пока нет</div>
                        ) : (
                            <div className="employees-table">
                                {sortEmployees(employees).map((employee) => {
                                    const canManage = getRoleRank(user?.role?.name) > getRoleRank(employee.roleName) &&
                                        employee.roleName !== "Owner";
                                    const employeeRoleOptions = getEmployeeRoleOptions(employee.roleName, availableRoleOptions);

                                    return (
                                        <article key={employee.id} className="employee-row">
                                            <div className="employee-main">
                                                <strong>{employee.fullName || employee.email}</strong>
                                                <span>{employee.email}</span>
                                                {!employee.isEmailConfirmed && (
                                                    <small>Почта не подтверждена</small>
                                                )}
                                            </div>
                                            <div className="employee-role-control">
                                                <select
                                                    value={employee.roleName}
                                                    onChange={(event) => handleRoleChange(employee, event.target.value)}
                                                    disabled={isSaving || !canManage || employeeRoleOptions.length <= 1}
                                                    aria-label="Должность"
                                                >
                                                    {employeeRoleOptions.map((role) => (
                                                        <option key={role.value} value={role.value}>{role.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="employee-actions">
                                                <button
                                                    type="button"
                                                    className="secondary-button danger"
                                                    onClick={() => setDismissCandidate(employee)}
                                                    disabled={isSaving || !canManage}
                                                >
                                                    Уволить
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </main>
            </div>

            {isCreateModalOpen && (
                <div className="employee-modal-backdrop" role="presentation">
                    <form className="employee-modal" onSubmit={handleCreateEmployee}>
                        <div className="employee-modal-header">
                            <h2>Новый сотрудник</h2>
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(false)}
                                aria-label="Закрыть"
                            >
                                ×
                            </button>
                        </div>

                        <label className="employee-modal-field">
                            <span>Email</span>
                            <input
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                required
                                autoFocus
                            />
                        </label>

                        <label className="employee-modal-field">
                            <span>Должность</span>
                            <select
                                value={roleName}
                                onChange={(event) => setRoleName(event.target.value)}
                                disabled={availableRoleOptions.length === 0}
                            >
                                {availableRoleOptions.map((role) => (
                                    <option key={role.value} value={role.value}>{role.label}</option>
                                ))}
                            </select>
                        </label>

                        <div className="employee-modal-actions">
                            <button type="button" className="secondary-button" onClick={() => setIsCreateModalOpen(false)}>
                                Отмена
                            </button>
                            <button type="submit" className="auth-submit-button" disabled={isSaving || availableRoleOptions.length === 0}>
                                Пригласить сотрудника
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {dismissCandidate && (
                <div className="employee-modal-backdrop" role="presentation">
                    <div className="employee-modal employee-confirm-modal" role="dialog" aria-modal="true">
                        <div className="employee-modal-header">
                            <h2>Уволить сотрудника?</h2>
                            <button
                                type="button"
                                onClick={() => setDismissCandidate(null)}
                                aria-label="Закрыть"
                            >
                                ×
                            </button>
                        </div>
                        <p>{dismissCandidate.fullName || dismissCandidate.email}</p>
                        <div className="employee-modal-actions">
                            <button type="button" className="secondary-button" onClick={() => setDismissCandidate(null)}>
                                Отмена
                            </button>
                            <button type="button" className="secondary-button danger" onClick={handleDismissConfirm} disabled={isSaving}>
                                Уволить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function sortEmployees(employees: AirlineEmployeeResponse[]): AirlineEmployeeResponse[] {
    return [...employees].sort((leftEmployee, rightEmployee) => {
        const rankDifference = getRoleRank(rightEmployee.roleName) - getRoleRank(leftEmployee.roleName);

        if (rankDifference !== 0) {
            return rankDifference;
        }

        return (leftEmployee.fullName || leftEmployee.email)
            .localeCompare(rightEmployee.fullName || rightEmployee.email, "ru");
    });
}

function getEmployeeRoleOptions(
    currentRoleName: string,
    availableRoleOptions: Array<{ value: string; label: string }>
): Array<{ value: string; label: string }> {
    const options = [...availableRoleOptions];

    if (!options.some((role) => role.value === currentRoleName)) {
        options.unshift({
            value: currentRoleName,
            label: roleLabels.get(currentRoleName) ?? currentRoleName
        });
    }

    return options;
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
