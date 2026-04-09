export interface UserDepartureResponse {
    id: number;
    modelName: string;
    takeOffAirport: string;
    landingAirport: string;
    takeOffDateTime: string;
    status: string;
    price: number;
    flightTime: string;
    distance: number;
    transfers: number;
    planeImage?: string;
    airlineImage?: string;
}