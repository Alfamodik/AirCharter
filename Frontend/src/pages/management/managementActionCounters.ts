import type { ManagementDepartureResponse } from "../../contracts/responses/departures/managementDepartureResponse";

export function isOrderAwaitingManagerAction(departure: ManagementDepartureResponse): boolean {
    return departure.currentStatusId === 2 ||
        (departure.currentStatusId === 19 && departure.hasContractDocument);
}

export function isFlightBehindSchedule(departure: ManagementDepartureResponse): boolean {
    const calculatedStatus = calculateScheduledFlightStatus(departure);

    if (calculatedStatus === null) {
        return false;
    }

    const sequence = buildOperationalStatusSequence(
        Math.max(1, departure.routeLegs.length),
        calculatedStatus.currentLegIndex ?? 0,
        calculatedStatus.statusId
    );
    const currentIndex = getCurrentOperationalStatusSequenceIndex(departure, sequence);
    const calculatedIndex = sequence.lastIndexOf(calculatedStatus.statusId);

    return currentIndex >= 0 && calculatedIndex >= 0 && currentIndex < calculatedIndex;
}

function calculateScheduledFlightStatus(departure: ManagementDepartureResponse): {
    statusId: number;
    currentLegIndex: number | null;
} | null {
    const takeOffDate = new Date(departure.requestedTakeOffDateTime);

    if (Number.isNaN(takeOffDate.getTime()) || departure.routeLegs.length === 0) {
        return null;
    }

    const now = new Date();
    let cursor = takeOffDate;

    if (now < cursor) {
        return {
            statusId: 3,
            currentLegIndex: null
        };
    }

    for (let index = 0; index < departure.routeLegs.length; index++) {
        const leg = departure.routeLegs[index];
        const legStart = cursor;
        const legEnd = addMinutes(legStart, timeSpanToMinutes(leg.flightTime) ?? 0);

        if (now <= legEnd) {
            return {
                statusId: 13,
                currentLegIndex: index
            };
        }

        const groundMinutes = timeSpanToMinutes(leg.groundTimeAfterArrival) ?? 0;
        const groundEnd = addMinutes(legEnd, groundMinutes);

        if (index < departure.routeLegs.length - 1 && groundMinutes > 0 && now <= groundEnd) {
            return {
                statusId: 21,
                currentLegIndex: index
            };
        }

        cursor = groundEnd;
    }

    return {
        statusId: 14,
        currentLegIndex: departure.routeLegs.length - 1
    };
}

function getCurrentOperationalStatusSequenceIndex(
    departure: ManagementDepartureResponse,
    sequence: number[]
): number {
    const currentStatusId = getCurrentOperationalSequenceStatusId(departure);

    if (currentStatusId === null) {
        return -1;
    }

    if (currentStatusId === 13 || currentStatusId === 21) {
        const occurrenceIndex = Math.max(
            getStatusOccurrenceCount(departure, currentStatusId) - 1,
            0
        );
        const sequenceIndex = findStatusSequenceIndexByOccurrence(
            sequence,
            currentStatusId,
            occurrenceIndex
        );

        return sequenceIndex >= 0 ? sequenceIndex : sequence.length;
    }

    return sequence.indexOf(currentStatusId);
}

function getCurrentOperationalSequenceStatusId(departure: ManagementDepartureResponse): number | null {
    for (let index = departure.statusHistory.length - 1; index >= 0; index--) {
        const statusId = departure.statusHistory[index].id;

        if (statusId !== 15 && statusId !== 16) {
            return statusId;
        }
    }

    return departure.currentStatusId === 15 || departure.currentStatusId === 16
        ? null
        : departure.currentStatusId;
}

function getStatusOccurrenceCount(
    departure: ManagementDepartureResponse,
    statusId: number
): number {
    return departure.statusHistory.filter((status) => status.id === statusId).length;
}

function findStatusSequenceIndexByOccurrence(
    sequence: number[],
    statusId: number,
    occurrenceIndex: number
): number {
    let seenCount = 0;

    for (let index = 0; index < sequence.length; index++) {
        if (sequence[index] !== statusId) {
            continue;
        }

        if (seenCount === occurrenceIndex) {
            return index;
        }

        seenCount++;
    }

    return -1;
}

function buildOperationalStatusSequence(
    routeLegCount: number,
    targetLegIndex: number,
    targetStatusId: number
): number[] {
    const sequence = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    const normalizedTargetLegIndex = Math.min(
        Math.max(targetLegIndex, 0),
        routeLegCount - 1
    );

    for (let legIndex = 0; legIndex < normalizedTargetLegIndex; legIndex++) {
        sequence.push(21, 13);
    }

    if (targetStatusId === 21) {
        sequence.push(21);
    } else if (targetStatusId === 14) {
        sequence.push(14);
    }

    return sequence;
}

function addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60_000);
}

function timeSpanToMinutes(value?: string | null): number | null {
    if (!value) {
        return null;
    }

    const match = value.match(/(?:(\d+)\.)?(\d+):(\d+)(?::(\d+))?/);

    if (!match) {
        return null;
    }

    const days = match[1] ? Number(match[1]) : 0;
    const hours = Number(match[2]);
    const minutes = Number(match[3]);

    return days * 24 * 60 + hours * 60 + minutes;
}
