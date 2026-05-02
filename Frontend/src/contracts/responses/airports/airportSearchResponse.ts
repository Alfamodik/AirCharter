export interface AirportSearchResponse {
    id: number;
    name: string;
    city?: string;
    country: string;
    iata?: string | null;
    icao?: string | null;
    latitude: number;
    longitude: number;
}
