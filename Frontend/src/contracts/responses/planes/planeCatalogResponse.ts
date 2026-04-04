export type PlaneResponse = {
    id: number;
    modelName: string;
    passengerCapacity: number;
    maxDistance: number;
    imageBase64?: string;
    distanceKm?: number;
    flightTime?: string;
    flightCost?: number;
    numberOfTransfers?: number;
};