import { sendRequest } from "./sendRequest";
import type { ManagementDepartureResponse } from "../contracts/responses/departures/managementDepartureResponse";
import type { AirportSearchResponse } from "../contracts/responses/airports/airportSearchResponse";

export type ManagementSection = "orders" | "flights" | "completed";

export interface UpdateDepartureRouteRequest {
    airportIds: number[];
    groundTimesAfterArrival: Array<string | null>;
}

export interface ManagementRoutePreviewResponse {
    distance: number;
    flightTime: string;
    price: number;
    transfers: number;
    canFly: boolean;
    routeAirports: AirportSearchResponse[];
    routeLegs: ManagementRoutePreviewLegResponse[];
}

export interface ManagementRoutePreviewLegResponse {
    fromAirportId: number;
    toAirportId: number;
    distanceKm: number;
    flightTime: string;
    flightCost: number;
    groundTimeAfterArrival?: string | null;
    canFly: boolean;
    maximumLegDistanceKm: number;
}

export async function getManagementDepartures(
    section: ManagementSection,
    signal?: AbortSignal
): Promise<ManagementDepartureResponse[]> {
    const searchParameters = new URLSearchParams({
        section
    });

    return await sendRequest<ManagementDepartureResponse[]>(
        `/departures/management?${searchParameters.toString()}`,
        "GET",
        undefined,
        signal
    );
}

export async function getManagementDeparture(
    departureId: number,
    signal?: AbortSignal
): Promise<ManagementDepartureResponse> {
    return await sendRequest<ManagementDepartureResponse>(
        `/departures/management/${departureId}`,
        "GET",
        undefined,
        signal
    );
}

export async function approveManagementDeparture(departureId: number): Promise<void> {
    await sendRequest<void>(
        `/departures/management/${departureId}/approve`,
        "POST"
    );
}

export async function approveManagementDepartureRoute(
    departureId: number,
    request: UpdateDepartureRouteRequest
): Promise<void> {
    await sendRequest<void>(
        `/departures/management/${departureId}/approve-route`,
        "POST",
        request
    );
}

export async function previewManagementDepartureRoute(
    departureId: number,
    request: UpdateDepartureRouteRequest,
    signal?: AbortSignal
): Promise<ManagementRoutePreviewResponse> {
    return await sendRequest<ManagementRoutePreviewResponse>(
        `/departures/management/${departureId}/route-preview`,
        "POST",
        request,
        signal
    );
}

export async function rejectManagementDeparture(departureId: number): Promise<void> {
    await sendRequest<void>(
        `/departures/management/${departureId}/reject`,
        "POST"
    );
}
