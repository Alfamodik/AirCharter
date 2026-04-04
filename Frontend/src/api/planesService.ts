import { sendRequest } from "./sendRequest";
import type { PlaneCatalogResponse } from "../contracts/responses/planes/planeCatalogResponse";

export async function getPlanes(): Promise<PlaneCatalogResponse[]> {
    return await sendRequest<PlaneCatalogResponse[]>("/planes", "GET");
}

export async function getCatalogPlanes(takeOffAirportId: number, landingAirportId: number): Promise<PlaneCatalogResponse[]> {
    return await sendRequest<PlaneCatalogResponse[]>("/flights/catalog-planes", "POST", {
        takeOffAirportId,
        landingAirportId
    });
}