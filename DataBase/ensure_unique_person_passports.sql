USE air_charter_extended;

SELECT
    passport_series,
    passport_number,
    COUNT(*) AS duplicates_count,
    GROUP_CONCAT(id ORDER BY id) AS person_ids
FROM persons
GROUP BY passport_series, passport_number
HAVING COUNT(*) > 1;

ALTER TABLE persons
    ADD UNIQUE KEY passport_unique (passport_series, passport_number);
