USE air_charter_extended;

SET FOREIGN_KEY_CHECKS = 0;

-- Если нужно полностью перезалить данные, раскомментируй:
-- TRUNCATE TABLE departure_employees;
-- TRUNCATE TABLE passenger_departure;
-- TRUNCATE TABLE departure_statuses;
-- TRUNCATE TABLE departures;
-- TRUNCATE TABLE statuses;
-- TRUNCATE TABLE planes;
-- TRUNCATE TABLE users;
-- TRUNCATE TABLE persons;
-- TRUNCATE TABLE airports;
-- TRUNCATE TABLE roles;
-- TRUNCATE TABLE airlines;

SET FOREIGN_KEY_CHECKS = 1;

-- Справочники
INSERT INTO roles (id, name)
VALUES
    (1, 'Client'),
    (2, 'AirlineManager');

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
    CASE
        WHEN IATA IS NULL OR TRIM(IATA) = '' OR UPPER(TRIM(IATA)) = 'NULL' THEN NULL
        WHEN UPPER(TRIM(IATA)) REGEXP '^[A-Z]{3}$' THEN UPPER(TRIM(IATA))
        ELSE NULL
    END,
    CASE
        WHEN ICAO IS NULL OR TRIM(ICAO) = '' OR UPPER(TRIM(ICAO)) = 'NULL' THEN NULL
        WHEN UPPER(TRIM(ICAO)) REGEXP '^[A-Z]{4}$' THEN UPPER(TRIM(ICAO))
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
    LEFT(COALESCE(name, CONCAT('Airline ', airline_id)), 45),
    COALESCE(date_of_creation, '2000-01-01'),
    LEFT(CONCAT('Организация ', COALESCE(name, CONCAT('Airline ', airline_id))), 100),
    LEFT(COALESCE(name, CONCAT('Airline ', airline_id)), 100),
    'Не указано',
    'Не указано',
    LEFT(COALESCE(representative_phone_number, ''), 20),
    CONCAT('airline', airline_id, '@legacy.local'),
    LEFT(CONCAT('Bank ', COALESCE(name, CONCAT('Airline ', airline_id))), 45),
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
    LEFT(COALESCE(first_name, 'Unknown'), 45),
    LEFT(COALESCE(last_name, 'Unknown'), 45),
    LEFT(patronymic, 45),
    COALESCE(passport_series, '0000'),
    COALESCE(passport_number, '000000'),
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
    LEFT(COALESCE(representative_first_name, 'Unknown'), 45),
    LEFT(COALESCE(representative_last_name, 'Unknown'), 45),
    LEFT(representative_patronymic, 45),
    '0000',
    LPAD(airline_id, 6, '0'),
    CONCAT('representative', airline_id, '@legacy.local'),
    NULL
FROM air_charter.airlines;

-- Пользователи
-- person_id берём из старого passenger_id, если он был
-- role_id = 2, если пользователь был привязан к авиакомпании, иначе 1
-- airline_id переносим напрямую
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
    CASE
        WHEN passenger_id IS NOT NULL THEN passenger_id
        WHEN airline_id IS NOT NULL THEN 100000 + airline_id
        ELSE NULL
    END,
    email,
    COALESCE(password, ''),
    CASE
        WHEN airline_id IS NOT NULL THEN 2
        ELSE 1
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
    passanger_capacity,
    cruising_speed,
    cost_per_kilometer,
    flight_hour_cost,
    image
)
SELECT
    plane_id,
    airline_id,
    LEFT(COALESCE(model_name, CONCAT('Plane ', plane_id)), 45),
    COALESCE(max_distance, 0),
    COALESCE(passanger_capacity, 0),
    COALESCE(cruising_speed, 0),
    COALESCE(cost_per_kilometer, 0),
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
    LEFT(COALESCE(status, 'Unknown'), 45)
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

-- Назначенные сотрудники на вылет
-- В новой схеме employee_id -> users.id
-- Поэтому сюда можно перенести только тех пользователей,
-- которые в старой базе были привязаны к airline_id
-- и представляют авиакомпанию вылета.
--
-- ВАЖНО:
-- этот импорт возможен только если в старой базе была таблица,
-- где реально хранилась связь сотрудников с вылетом.
-- Ниже пример для случая, если такая таблица называется departureemployees
-- и хранит airline employee через airline_id или user_id.
--
-- ЕСЛИ ТАКОЙ ТАБЛИЦЫ НЕТ, ЭТОТ БЛОК УДАЛИ.

-- Вариант 1: если в старой таблице уже был user_id
-- INSERT INTO departure_employees
-- (
--     id,
--     departure_id,
--     employee_id
-- )
-- SELECT
--     departure_employee_id,
--     departure_id,
--     user_id
-- FROM air_charter.departureemployees;

-- Вариант 2: если в старой базе был только airline_id, а назначать надо менеджера авиакомпании
-- INSERT INTO departure_employees
-- (
--     id,
--     departure_id,
--     employee_id
-- )
-- SELECT
--     de.departure_employee_id,
--     de.departure_id,
--     u.id
-- FROM air_charter.departureemployees de
-- INNER JOIN users u ON u.airline_id = de.airline_id AND u.role_id = 2;

-- Сброс автонумерации
ALTER TABLE airlines AUTO_INCREMENT = 18;
ALTER TABLE roles AUTO_INCREMENT = 3;
ALTER TABLE persons AUTO_INCREMENT = 100018;
ALTER TABLE users AUTO_INCREMENT = 10;
ALTER TABLE planes AUTO_INCREMENT = 9;
ALTER TABLE airports AUTO_INCREMENT = 7699;
ALTER TABLE departures AUTO_INCREMENT = 22;
ALTER TABLE statuses AUTO_INCREMENT = 144;
ALTER TABLE departure_statuses AUTO_INCREMENT = 64;
ALTER TABLE departure_employees AUTO_INCREMENT = 1;

-- Проверка итогов
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