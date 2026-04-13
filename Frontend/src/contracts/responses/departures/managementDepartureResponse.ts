export interface ManagementDepartureResponse {
    id: number;
    planeModelName: string;
    takeOffAirportName: string;
    takeOffAirportCity?: string | null;
    takeOffAirportIata?: string | null;
    takeOffAirportIcao?: string | null;
    landingAirportName: string;
    landingAirportCity?: string | null;
    landingAirportIata?: string | null;
    landingAirportIcao?: string | null;
    requestedTakeOffDateTime: string;
    price: number;
    statusName: string;
    charterRequesterEmail: string;
}