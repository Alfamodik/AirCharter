export interface ManagementPlaneResponse {
    id: number;
    modelName: string;
    maxDistance: number;
    passengerCapacity: number;
    cruisingSpeed: number;
    flightHourCost: number;
    imageBase64?: string | null;
}

export interface SavePlaneRequest {
    modelName: string;
    maxDistance: number;
    passengerCapacity: number;
    cruisingSpeed: number;
    flightHourCost: number;
    imageBase64?: string | null;
}
