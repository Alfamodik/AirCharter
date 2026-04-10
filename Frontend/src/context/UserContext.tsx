import React, { createContext, useContext, useEffect, useState } from "react";
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