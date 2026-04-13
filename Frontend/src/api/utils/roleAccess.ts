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