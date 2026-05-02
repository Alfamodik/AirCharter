export interface ManagementDepartureResponse {
    id: number;
    planeModelName: string;
    planePassengerCapacity: number;
    takeOffAirportId: number;
    takeOffAirportName: string;
    takeOffAirportCity?: string | null;
    takeOffAirportIata?: string | null;
    takeOffAirportIcao?: string | null;
    landingAirportId: number;
    landingAirportName: string;
    landingAirportCity?: string | null;
    landingAirportIata?: string | null;
    landingAirportIcao?: string | null;
    requestedTakeOffDateTime: string;
    arrivalDateTime: string;
    createdAt?: string | null;
    price: number;
    distance: number;
    flightTime: string;
    transfers: number;
    currentStatusId: number;
    statusName: string;
    currentStatusSetAt: string;
    charterRequesterEmail: string;
    passengerCount: number;
    canEditRoute: boolean;
    canApprove: boolean;
    canChangeStatus: boolean;
    passengers: ManagementPassengerResponse[];
    statusHistory: ManagementDepartureStatusResponse[];
    routeAirports: ManagementRouteAirportResponse[];
    routeLegs: ManagementRouteLegResponse[];
}

export interface ManagementPassengerResponse {
    id: number;
    fullName: string;
    email?: string | null;
}

export interface ManagementDepartureStatusResponse {
    id: number;
    name: string;
    setAt: string;
}

export interface ManagementRouteAirportResponse {
    id: number;
    name: string;
    city?: string | null;
    country: string;
    iata?: string | null;
    icao?: string | null;
    latitude: number;
    longitude: number;
}

export interface ManagementRouteLegResponse {
    fromAirportId: number;
    toAirportId: number;
    distanceKm: number;
    flightTime: string;
    flightCost: number;
    groundTimeAfterArrival?: string | null;
}
