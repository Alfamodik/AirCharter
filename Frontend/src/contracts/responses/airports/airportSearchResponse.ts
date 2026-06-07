// TypeScript-тип airportSearchResponse описывает форму данных, которые frontend получает от backend.

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
