import { Link, useNavigate } from "react-router-dom";
import { useUser } from "../../context/UserContext";
import "./Header.css";

interface HeaderProps {
    searchValue?: string;
    onSearchChange?: (value: string) => void;
    showSearch?: boolean;
    children?: React.ReactNode;
}

export default function Header({ 
    searchValue, 
    onSearchChange, 
    showSearch = false,
    children 
}: HeaderProps) {
    const { user, isLoading, logout } = useUser();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    return (
        <header className="catalog-navbar">
            <div className="navbar-logo">
                {children}
                
                <Link to="/catalog" className="logo-link">
                    <span className="logo-text">AirCharter</span>
                </Link>
            </div>

            <div className="navbar-search-container">
                {showSearch && (
                    <input
                        type="text"
                        className="navbar-search-input"
                        placeholder="Поиск по модели..."
                        value={searchValue}
                        onChange={(e) => onSearchChange?.(e.target.value)}
                    />
                )}
            </div>

            <div className="navbar-actions">
                {!isLoading && (
                    <>
                        {user ? (
                            <>
                                <button onClick={handleLogout} className="navbar-link logout-btn">
                                    Выход
                                </button>
                                <Link to="/cabinet" className="navbar-link management-link">
                                    Личный кабинет
                                </Link>
                                {user.airlineId && (
                                    <Link to="/management" className="navbar-link management-link">
                                        Управление вылетами
                                    </Link>
                                )}
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="navbar-link">Вход</Link>
                                <Link to="/register" className="navbar-link register-btn">Регистрация</Link>
                            </>
                        )}
                    </>
                )}
            </div>
        </header>
    );
}