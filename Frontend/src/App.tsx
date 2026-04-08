import { BrowserRouter, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ConfirmEmailPage from "./pages/auth/ConfirmEmailPage";
import CatalogPage from "./pages/catalog/CatalogPage";
import CabinetPage from "./pages/Cabinet/CabinetPage"

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<CatalogPage />} />
                <Route path="/catalog" element={<CatalogPage/>} />

                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/confirm-email" element={<ConfirmEmailPage />} />

                <Route path="/cabinet" element={<CabinetPage />} />
            </Routes>
        </BrowserRouter>
    );
}