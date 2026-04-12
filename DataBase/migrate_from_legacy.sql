USE air_charter_extended;

-- Справочники
INSERT INTO roles (id, name)
VALUES
    (1, 'Client'),
    (2, 'Owner'),
    (3, 'Manager'),
    (4, 'Admin'),
    (5, 'GeneralDirector'),
    (6, 'Pilot'),
    (7, 'CoPilot'),
    (8, 'FlightAttendant'),
    (9, 'Technician');

-- Аэропорты
INSERT INTO airports
(
    id,
    name,
    city,
    country,
    iata,
    icao,
    latitude,
    longitude
)
SELECT
    airport_id,
    name,
    city,
    country,
    CASE
        WHEN iata IS NULL OR TRIM(iata) = '' OR UPPER(TRIM(iata)) = 'NULL' THEN NULL
        WHEN UPPER(TRIM(iata)) REGEXP '^[A-Z]{3}$' THEN UPPER(TRIM(iata))
        ELSE NULL
    END,
    CASE
        WHEN icao IS NULL OR TRIM(icao) = '' OR UPPER(TRIM(icao)) = 'NULL' THEN NULL
        WHEN UPPER(TRIM(icao)) REGEXP '^[A-Z]{4}$' THEN UPPER(TRIM(icao))
        ELSE NULL
    END,
    ROUND(COALESCE(latitude, 0), 6),
    ROUND(COALESCE(longitude, 0), 6)
FROM air_charter.airport;

-- Авиакомпании
INSERT INTO airlines
(
    id,
    airline_name,
    creation_date,
    organization_full_name,
    organization_short_name,
    legal_address,
    postal_address,
    phone_number,
    email,
    service_base_cost,
    transfer_base_cost,
    bank_name,
    taxpayer_id,
    tax_registration_reason_code,
    primary_state_registration_number,
    current_account_number,
    correspondent_account_number,
    bank_identifier_code,
    image
)
SELECT
    airline_id,
    name,
    COALESCE(date_of_creation, '2000-01-01'),
    CONCAT('Общество с ограниченной ответственностью «', name, "»"),
    CONCAT('ООО «', name, "»"),
    'Не указано',
    'Не указано',
    COALESCE(representative_phone_number, ''),
    CONCAT('airline', airline_id, '@legacy.local'),
    50000,
    100000,
    CONCAT('Bank ', name),
    LPAD(airline_id, 12, '0'),
    LPAD(airline_id, 9, '0'),
    LPAD(airline_id, 15, '0'),
    LPAD(airline_id, 20, '0'),
    LPAD(airline_id, 20, '0'),
    LPAD(airline_id, 9, '0'),
    image
FROM air_charter.airlines;

-- Пассажиры -> persons
INSERT INTO persons
(
    id,
    first_name,
    last_name,
    patronymic,
    passport_series,
    passport_number,
    email,
    birth_date
)
SELECT
    passenger_id,
    first_name,
    last_name,
    patronymic,
    COALESCE(passport_series, '0000'),
    COALESCE(passport_number, '000000'),
    NULL,
    NULL
FROM air_charter.passengers;

-- Пользователи
INSERT INTO users
(
    id,
    person_id,
    email,
    password_hash,
    role_id,
    airline_id,
    email_confirmation_code_hash,
    email_confirmation_code_expires_at_utc,
    is_email_confirmed,
    is_active
)
SELECT
    user_id,
    passenger_id,
    email,
    COALESCE(password, ''),
    CASE
        WHEN airline_id IS NULL THEN 1
        ELSE 2
    END,
    airline_id,
    NULL,
    NULL,
    1,
    1
FROM air_charter.users;

-- Самолёты
INSERT INTO planes
(
    id,
    airline_id,
    model_name,
    max_distance,
    passenger_capacity,
    cruising_speed,
    flight_hour_cost,
    image
)
SELECT
    plane_id,
    airline_id,
    model_name,
    COALESCE(max_distance, 0),
    COALESCE(passenger_capacity, 0),
    COALESCE(cruising_speed, 0),
    0,
    image
FROM air_charter.plane;

-- Статусы
INSERT INTO statuses
(
    id,
    status
)
SELECT
    status_id,
    status
FROM air_charter.statuses;

-- Вылеты
INSERT INTO departures
(
    id,
    charter_requester_id,
    plane_id,
    take_off_airport_id,
    landing_airport_id,
    distance,
    flight_time,
    price,
    transfers,
    requested_take_off_date_time
)
SELECT
    d.departure_id,
    d.charter_requester,
    d.plane_id,
    d.take_off_airport_id,
    d.landing_airport_id,
    COALESCE(d.distance, 0),
    CASE
        WHEN p.cruising_speed IS NULL
             OR p.cruising_speed = 0
             OR d.distance IS NULL
            THEN '00:00:00'
        ELSE SEC_TO_TIME(ROUND(d.distance / p.cruising_speed * 3600))
    END,
    CASE
        WHEN d.distance IS NULL OR p.cost_per_kilometer IS NULL
            THEN 0
        ELSE ROUND(d.distance * p.cost_per_kilometer, 2)
    END,
    0,
    d.requested_take_off_date_time
FROM air_charter.departure d
INNER JOIN air_charter.plane p ON p.plane_id = d.plane_id;

-- История статусов вылетов
INSERT INTO departure_statuses
(
    id,
    departure_id,
    status_id,
    status_setting_date_time
)
SELECT
    departure_status_id,
    departure_id,
    status_id,
    status_setting_date_time
FROM air_charter.departurestatuses;

-- Пассажиры вылетов
INSERT INTO passenger_departure
(
    departure_id,
    person_id
)
SELECT
    departure_id,
    passenger_id
FROM air_charter.passengerdeparture;

-- Итоги
SELECT 'airlines' AS table_name, COUNT(*) AS rows_count FROM airlines
UNION ALL
SELECT 'roles', COUNT(*) FROM roles
UNION ALL
SELECT 'persons', COUNT(*) FROM persons
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'planes', COUNT(*) FROM planes
UNION ALL
SELECT 'airports', COUNT(*) FROM airports
UNION ALL
SELECT 'departures', COUNT(*) FROM departures
UNION ALL
SELECT 'statuses', COUNT(*) FROM statuses
UNION ALL
SELECT 'departure_statuses', COUNT(*) FROM departure_statuses
UNION ALL
SELECT 'passenger_departure', COUNT(*) FROM passenger_departure
UNION ALL
SELECT 'departure_employees', COUNT(*) FROM departure_employees;