// React-контекст UserContext хранит общее состояние приложения и передает его компонентам без ручной прокладки props.

import React, { createContext, useContext, useEffect, useState } from "react";
import { logout as logoutSession } from "../api/authService";
import { getCurrentUser } from "../api/userService";
import type { UserProfileResponse } from "../contracts/responses/users/userPersonResponse";

interface UserContextType {
    user: UserProfileResponse | null;
    isLoading: boolean;
    logout: () => void;
    refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<UserProfileResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Профиль запрашивается после загрузки приложения и повторно после входа, чтобы роли сразу обновились в интерфейсе.
    const fetchUser = async () => {
        setIsLoading(true);
        try {
            const data = await getCurrentUser();
            setUser(data);
        } catch {
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUser();
    }, []);

    const logout = () => {
        // Backend очищает refresh-cookie, а frontend отдельно убирает access-токен из localStorage.
        void logoutSession().catch(() => undefined);
        localStorage.removeItem("accessToken");
        setUser(null);
    };

    return (
        <UserContext.Provider value={{ user, isLoading, logout, refreshUser: fetchUser }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error("useUser must be used within a UserProvider");
    }
    return context;
};
