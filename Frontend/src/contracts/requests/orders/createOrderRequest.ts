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

export interface PlaneCatalogResponse {
    id: number;
    modelName: string;
    passengerCapacity: number;
    maxDistance: number;
    isRouteFound: boolean;
    distanceKm: number;
    flightTime: string;
    flightCost: number;
    numberOfTransfers: number;
    routeAirports: AirportRouteResponse[];
    routeLegs: RouteLegResponse[];
    imageBase64?: string | null;
}

export interface AirportRouteResponse {
    id: number;
    name: string;
    city?: string | null;
    country: string;
    iata?: string | null;
    icao?: string | null;
    latitude: number;
    longitude: number;
}

export interface RouteLegResponse {
    fromAirportId: number;
    toAirportId: number;
    distanceKm: number;
    flightTime: string;
    flightCost: number;
    groundTimeAfterArrival: string | null;
}
