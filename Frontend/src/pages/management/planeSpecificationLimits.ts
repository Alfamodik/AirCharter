export const planeSpecificationLimits = {
    maxDistance: {
        min: 1000,
        max: 20000
    },
    passengerCapacity: {
        min: 1,
        max: 400
    },
    cruisingSpeed: {
        min: 200,
        max: 2500
    },
    flightHourCost: {
        min: 10000,
        max: 50000000
    }
} as const;

export function isInRange(value: number, min: number, max: number): boolean {
    return Number.isFinite(value) && value >= min && value <= max;
}
