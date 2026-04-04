USE air_charter_extended;

SET FOREIGN_KEY_CHECKS = 0;

SET FOREIGN_KEY_CHECKS = 1;

-- Справочники
INSERT INTO roles (id, name)
VALUES
    (1, 'Client'),
    (2, 'AirlineManager');

INSERT INTO positions (id, name)
VALUES
    (1, 'Representative');

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
    LEFT(COALESCE(name, CONCAT('Airport ', airport_id)), 45),
    LEFT(COALESCE(city, 'Unknown'), 45),
    LEFT(COALESCE(country, 'Unknown'), 45),
    UPPER(COALESCE(IATA, CONCAT('X', LPAD(airport_id, 2, '0')))),
    UPPER(COALESCE(ICAO, CONCAT('X', LPAD(airport_id, 3, '0')))),
    ROUND(COALESCE(latitude, 0), 6),
    ROUND(COALESCE(longitude, 0), 6)
FROM air_charter.airport;

-- Технические банковские реквизиты под авиакомпании
INSERT INTO bank_details
(
    id,
    bank_name,
    taxpayer_id,
    tax_registration_reason_code,
    primary_state_registration_number,
    current_account_number,
    correspondent_account_number,
    bank_identifier_code
)
SELECT
    airline_id,
    LEFT(CONCAT('Bank ', name), 45),
    LPAD(airline_id, 12, '0'),
    LPAD(airline_id, 9, '0'),
    LPAD(airline_id, 15, '0'),
    LPAD(airline_id, 20, '0'),
    LPAD(airline_id, 20, '0'),
    LPAD(airline_id, 9, '0')
FROM air_charter.airlines;

-- Авиакомпании
INSERT INTO airlines
(
    id,
    bank_details_id,
    airline_name,
    creation_date,
    organization_full_name,
    organization_short_name,
    legal_address,
    postal_address,
    phone_number,
    email,
    image
)
SELECT
    airline_id,
    airline_id,
    LEFT(name, 45),
    date_of_creation,
    LEFT(CONCAT('Организация ', name), 100),
    LEFT(name, 100),
    'Не указано',
    'Не указано',
    LEFT(representative_phone_number, 20),
    CONCAT('airline', airline_id, '@legacy.local'),
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
    LEFT(first_name, 45),
    LEFT(last_name, 45),
    LEFT(patronymic, 45),
    passport_series,
    passport_number,
    NULL,
    NULL
FROM air_charter.passengers;

-- Представители авиакомпаний -> persons
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
    100000 + airline_id,
    LEFT(representative_first_name, 45),
    LEFT(representative_last_name, 45),
    LEFT(representative_patronymic, 45),
    '0000',
    LPAD(airline_id, 6, '0'),
    CONCAT('representative', airline_id, '@legacy.local'),
    NULL
FROM air_charter.airlines;

-- Представители авиакомпаний -> employees
INSERT INTO employees
(
    id,
    person_id,
    position_id,
    airline_id
)
SELECT
    airline_id,
    100000 + airline_id,
    1,
    airline_id
FROM air_charter.airlines;

-- Самолёты
INSERT INTO planes
(
    id,
    airline_id,
    model_name,
    max_distance,
    passanger_capacity,
    cruising_speed,
    cost_per_kilometer,
    flight_hour_cost,
    image
)
SELECT
    plane_id,
    airline_id,
    LEFT(model_name, 45),
    max_distance,
    passanger_capacity,
    cruising_speed,
    cost_per_kilometer,
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
    LEFT(status, 45)
FROM air_charter.statuses;

-- Пользователи
-- person_id берём из старого passenger_id, если он был
-- role_id = 2, если пользователь был привязан к авиакомпании, иначе 1
-- password_hash переносится как есть
INSERT INTO users
(
    id,
    person_id,
    role_id,
    bank_details_id,
    email,
    password_hash,
    legal_address,
    actual_address,
    email_confirmation_code_hash,
    email_confirmation_code_expires_at_utc,
    is_email_confirmed,
    is_active
)
SELECT
    user_id,
    passenger_id,
    CASE
        WHEN airline_id IS NOT NULL THEN 2
        ELSE 1
    END,
    CASE
        WHEN airline_id IS NOT NULL THEN airline_id
        ELSE NULL
    END,
    email,
    COALESCE(password, ''),
    NULL,
    NULL,
    NULL,
    NULL,
    1,
    1
FROM air_charter.users;

-- Вылеты
-- flight_time вычисляется приблизительно по расстоянию и крейсерской скорости
INSERT INTO departures
(
    id,
    charter_requester_id,
    plane_id,
    take_off_airport_id,
    landing_airport_id,
    distance,
    flight_time,
    requested_take_off_date_time
)
SELECT
    d.departure_id,
    d.charter_requester,
    d.plane_id,
    d.take_off_airport_id,
    d.landing_airport_id,
    d.distance,
    CASE
        WHEN p.cruising_speed IS NULL OR p.cruising_speed = 0 THEN '00:00:00'
        ELSE SEC_TO_TIME(ROUND(d.distance / p.cruising_speed * 3600))
    END,
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

-- Сброс автонумерации
ALTER TABLE airports AUTO_INCREMENT = 7699;
ALTER TABLE bank_details AUTO_INCREMENT = 100001;
ALTER TABLE airlines AUTO_INCREMENT = 18;
ALTER TABLE persons AUTO_INCREMENT = 100018;
ALTER TABLE employees AUTO_INCREMENT = 18;
ALTER TABLE users AUTO_INCREMENT = 10;
ALTER TABLE planes AUTO_INCREMENT = 9;
ALTER TABLE statuses AUTO_INCREMENT = 144;
ALTER TABLE departures AUTO_INCREMENT = 22;
ALTER TABLE departure_statuses AUTO_INCREMENT = 64;

-- Проверка итогов
SELECT 'airports' AS table_name, COUNT(*) AS rows_count FROM airports
UNION ALL
SELECT 'bank_details', COUNT(*) FROM bank_details
UNION ALL
SELECT 'airlines', COUNT(*) FROM airlines
UNION ALL
SELECT 'persons', COUNT(*) FROM persons
UNION ALL
SELECT 'employees', COUNT(*) FROM employees
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'planes', COUNT(*) FROM planes
UNION ALL
SELECT 'statuses', COUNT(*) FROM statuses
UNION ALL
SELECT 'departures', COUNT(*) FROM departures
UNION ALL
SELECT 'departure_statuses', COUNT(*) FROM departure_statuses
UNION ALL
SELECT 'passenger_departure', COUNT(*) FROM passenger_departure;
