import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { hasManagementAccess } from "../api/utils/roleAccess";

export default function StaffRoute() {
    const location = useLocation();
    const { user, isLoading } = useUser();

    if (isLoading) {
        return <div className="catalog-message">Загрузка данных...</div>;
    }

    if (user === null) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    if (!hasManagementAccess(user.role?.name)) {
        return <Navigate to="/catalog" replace />;
    }

    return <Outlet />;
}