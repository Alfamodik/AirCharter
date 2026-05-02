SET sql_safe_updates = 0;

UPDATE departures AS departure
JOIN (
    SELECT
        departure_id,
        SUM(distance) AS distance,
        SEC_TO_TIME(
            1800
            + SUM(TIME_TO_SEC(flight_time))
            + COALESCE(SUM(TIME_TO_SEC(ground_time_after_arrival)), 0)
        ) AS flight_time,
        SUM(flight_cost) AS price,
        COUNT(*) - 1 AS transfers
    FROM departure_route_legs
    GROUP BY departure_id
) AS route_totals
    ON route_totals.departure_id = departure.id
SET
    departure.distance = route_totals.distance,
    departure.flight_time = route_totals.flight_time,
    departure.price = route_totals.price,
    departure.transfers = route_totals.transfers;
