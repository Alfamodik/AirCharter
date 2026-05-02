import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { unauthorizedResponseEventName } from "./api/sendRequest";
import ProtectedRoute from "./components/ProtectedRoute";

import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ConfirmEmailPage from "./pages/auth/ConfirmEmailPage";

import CatalogPage from "./pages/catalog/CatalogPage";
import CabinetPage from "./pages/cabinet/CabinetPage";
import CabinetDeparturePage from "./pages/cabinet/CabinetDeparturePage";
import ProfilePage from "./pages/profilePage/ProfilePage";
import OrderPage from "./pages/orderPage/OrderPage.tsx";
import StaffRoute from "./components/StaffRoute";
import ManagementPage from "./pages/management/ManagementPage";
import ManagementOrderRoutePage from "./pages/management/ManagementOrderRoutePage";
import { useUser } from "./context/UserContext";

export default function App() {
    return (
        <BrowserRouter>
            <UnauthorizedRedirect />
            <Routes>
                <Route path="/" element={<CatalogPage />} />
                <Route path="/catalog" element={<CatalogPage/>} />

                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/confirm-email" element={<ConfirmEmailPage />} />

                <Route path="/cabinet" element={<ProtectedRoute><CabinetPage/></ProtectedRoute>} />
                <Route path="/cabinet/departures/:departureId" element={<ProtectedRoute><CabinetDeparturePage /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><ProfilePage/></ProtectedRoute>} />
                <Route path="/create-order" element={<ProtectedRoute><OrderPage/></ProtectedRoute>} />
                <Route element={<StaffRoute />}>
                    <Route path="/management" element={<ManagementPage />} />
                    <Route path="/management/orders" element={<ManagementPage />} />
                    <Route path="/management/orders/:departureId" element={<ManagementOrderRoutePage />} />
                    <Route path="/management/flights" element={<ManagementPage />} />
                    <Route path="/management/completed" element={<ManagementPage />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

function UnauthorizedRedirect() {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout } = useUser();

    useEffect(() => {
        function handleUnauthorizedResponse() {
            logout();

            if (location.pathname !== "/login") {
                navigate("/login", {
                    replace: true,
                    state: { from: location }
                });
            }
        }

        window.addEventListener(unauthorizedResponseEventName, handleUnauthorizedResponse);

        return () => {
            window.removeEventListener(unauthorizedResponseEventName, handleUnauthorizedResponse);
        };
    }, [location, logout, navigate]);

    return null;
}
