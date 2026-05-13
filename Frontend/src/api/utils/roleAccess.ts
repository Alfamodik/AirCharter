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

const allowedManagementEditorRoles = new Set([
    "Owner",
    "Manager",
    "Admin",
    "GeneralDirector"
]);

export function hasManagementEditAccess(roleName?: string | null): boolean {
    if (!roleName) {
        return false;
    }

    return allowedManagementEditorRoles.has(roleName);
}

const allowedOrderManagementRoles = allowedManagementEditorRoles;

export function hasOrderManagementAccess(roleName?: string | null): boolean {
    if (!roleName) {
        return false;
    }

    return allowedOrderManagementRoles.has(roleName);
}

const allowedPlaneManagementRoles = new Set([
    "Owner",
    "Admin",
    "GeneralDirector"
]);

export function hasPlaneManagementAccess(roleName?: string | null): boolean {
    if (!roleName) {
        return false;
    }

    return allowedPlaneManagementRoles.has(roleName);
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
