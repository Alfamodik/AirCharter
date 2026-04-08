import React, { createContext, useContext, useEffect, useState } from "react";
import { getCurrentUser } from "../api/userService";
import type { UserProfileResponse } from "../contracts/responses/users/userProfileResponse";

interface UserContextType {
    user: UserProfileResponse | null;
    isLoading: boolean;
    refreshUser: () => Promise<void>;
    logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<UserProfileResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refreshUser = async () => {
        const token = localStorage.getItem("accessToken");
        if (!token) {
            setUser(null);
            setIsLoading(false);
            return;
        }

        try {
            const data = await getCurrentUser();
            setUser(data);
        } catch (error) {
            console.error("User context error:", error);
            localStorage.removeItem("accessToken");
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem("accessToken");
        setUser(null);
        window.location.href = "/login";
    };

    useEffect(() => {
        refreshUser();
    }, []);

    return (
        <UserContext.Provider value={{ user, isLoading, refreshUser, logout }}>
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