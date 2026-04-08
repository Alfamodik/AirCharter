import { Link } from "react-router-dom";
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
                                <button onClick={logout} className="navbar-link logout-btn">Выход</button>
                                <a href="/cabinet" className="navbar-link management-link">Личный кабинет</a>
                                {user.airlineId && (
                                    <a href="/management" className="navbar-link management-link">Управление вылетами</a>
                                )}
                            </>
                        ) : (
                            <>
                                <a href="/login" className="navbar-link">Вход</a>
                                <a href="/register" className="navbar-link register-btn">Регистрация</a>
                            </>
                        )}
                    </>
                )}
            </div>
        </header>
    );
}