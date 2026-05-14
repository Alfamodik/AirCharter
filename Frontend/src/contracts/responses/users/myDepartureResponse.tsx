export interface MyDepartureResponse {
    id: number;
    modelName: string;
    takeOffAirport: string;
    landingAirport: string;
    takeOffDateTime: string;
    createdAt?: string | null;
    currentStatusId?: number | null;
    status: string;
    hasContractDocument: boolean;
    price: number;
    flightTime: string;
    distance: number;
    transfers: number;
    planeImage?: string;
    airlineImage?: string;
}
