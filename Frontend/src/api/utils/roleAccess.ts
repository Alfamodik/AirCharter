const allowedManagementRoles = new Set([
    "Owner",
    "Manager",
    "Admin",
    "GeneralDirector",
    "Employee"
]);

export function hasManagementAccess(roleName?: string | null): boolean {
    if (!roleName) {
        return false;
    }

    return allowedManagementRoles.has(roleName);
}

const allowedAirlineProfileRoles = new Set([
    "Owner",
    "GeneralDirector"
]);

export function hasAirlineProfileAccess(roleName?: string | null): boolean {
    if (!roleName) {
        return false;
    }

    return allowedAirlineProfileRoles.has(roleName);
}
