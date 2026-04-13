import { sendRequest } from "./sendRequest";
import type { CreateOrderRequest, FlightCostRequest, FlightCostResponse } from "../contracts/requests/orders/createOrderRequest";

export async function createOrder(request: CreateOrderRequest): Promise<void> {
    return await sendRequest<void>("/departures/create-order", "POST", request);
}

export async function getFlightCost(request: FlightCostRequest): Promise<FlightCostResponse> {
    return await sendRequest<FlightCostResponse>("/departures/calculate-cost", "POST", request);
}