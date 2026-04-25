import { sendRequest } from "./sendRequest";
import type { CreateOrderRequest, FlightCostRequest, PlaneCatalogResponse } from "../contracts/requests/orders/createOrderRequest";

export async function createOrder(request: CreateOrderRequest): Promise<void> {
    return await sendRequest<void>("/departures/create-order", "POST", request);
}

export async function getFlightCost(request: FlightCostRequest): Promise<PlaneCatalogResponse> {
    return await sendRequest<PlaneCatalogResponse>("/departures/calculate-cost", "POST", request);
}