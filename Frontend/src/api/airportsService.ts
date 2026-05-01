import type { AirportSearchResponse } from "../contracts/responses/airports/airportSearchResponse";
import { sendRequest } from "./sendRequest";

export async function searchAirports(
    query: string,
    limit: number = 10,
    signal?: AbortSignal
): Promise<AirportSearchResponse[]> {
    const searchParams = new URLSearchParams({
        query: query,
        limit: limit.toString()
    });

    return await sendRequest<AirportSearchResponse[]>(
        `/airports/search?${searchParams.toString()}`,
        "GET",
        undefined,
        signal
    );
}
