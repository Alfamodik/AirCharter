import { sendRequest } from "./sendRequest";
import type { PlaneCatalogResponse } from "../contracts/responses/planes/planeCatalogResponse";
import type {
    ManagementPlaneResponse,
    SavePlaneRequest
} from "../contracts/responses/planes/managementPlaneResponse";

export async function getPlanes(): Promise<PlaneCatalogResponse[]> {
    return await sendRequest<PlaneCatalogResponse[]>("/planes", "GET");
}

export async function getCatalogPlanes(takeOffAirportId: number, landingAirportId: number): Promise<PlaneCatalogResponse[]> {
    return await sendRequest<PlaneCatalogResponse[]>("/flights/catalog-planes", "POST", {
        takeOffAirportId,
        landingAirportId
    });
}

export async function getMyPlanes(signal?: AbortSignal): Promise<ManagementPlaneResponse[]> {
    return await sendRequest<ManagementPlaneResponse[]>("/planes/my", "GET", undefined, signal);
}

export async function getMyPlane(
    planeId: number,
    signal?: AbortSignal
): Promise<ManagementPlaneResponse> {
    return await sendRequest<ManagementPlaneResponse>(
        `/planes/my/${planeId}`,
        "GET",
        undefined,
        signal
    );
}

export async function createMyPlane(request: SavePlaneRequest): Promise<ManagementPlaneResponse> {
    return await sendRequest<ManagementPlaneResponse>("/planes/my", "POST", request);
}

export async function updateMyPlane(
    planeId: number,
    request: SavePlaneRequest
): Promise<ManagementPlaneResponse> {
    return await sendRequest<ManagementPlaneResponse>(`/planes/my/${planeId}`, "PUT", request);
}
