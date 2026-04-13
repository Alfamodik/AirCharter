import { sendRequest } from "./sendRequest";
import type { ManagementDepartureResponse } from "../contracts/responses/departures/managementDepartureResponse";

export async function getManagementDepartures(signal?: AbortSignal): Promise<ManagementDepartureResponse[]> {
    return await sendRequest<ManagementDepartureResponse[]>("/departures/management","GET",
        undefined,
        signal
    );
}