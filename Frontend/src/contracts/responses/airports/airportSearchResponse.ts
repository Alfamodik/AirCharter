export interface AirportSearchResponse {
    id: number;
    name: string;
    city: string;
    iata?: string | null;
    icao?: string | null;
}