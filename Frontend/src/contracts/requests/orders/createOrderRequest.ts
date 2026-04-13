export interface CreateOrderRequest {
    planeId: number;
    takeOffAirportId: number;
    landingAirportId: number;
    requestedTakeOffDateTime: string;
}

export interface FlightCostRequest {
    planeId: number;
    takeOffAirportId: number;
    landingAirportId: number;
}

export interface FlightCostResponse {
    cost: number;
}