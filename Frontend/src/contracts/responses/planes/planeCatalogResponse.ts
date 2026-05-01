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
    routeAirports: AirportResponse[];
    routeLegs: RouteLegResponse[];
    imageBase64: string;
}

export interface AirportResponse {
    id: number;
    name: string;
    city: string;
    country: string;
    iata: string | null;
    icao: string;
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
