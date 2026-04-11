export interface AirportSearchResponse {
    id: number;
    name: string;
    city?: string | null;
    iata?: string | null;
    icao?: string | null;
}