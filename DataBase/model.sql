CREATE DATABASE IF NOT EXISTS air_charter_extended;
USE air_charter_extended;

CREATE TABLE airlines(
	id INT PRIMARY KEY AUTO_INCREMENT,
    airline_name VARCHAR(45) NOT NULL UNIQUE,
    creation_date DATE NOT NULL,
    organization_full_name VARCHAR(100) NOT NULL UNIQUE,
    organization_short_name VARCHAR(100) NOT NULL UNIQUE,
    legal_address VARCHAR(255) NOT NULL,
    postal_address VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
	bank_name VARCHAR(45) NOT NULL,
    taxpayer_id VARCHAR(12) NOT NULL,
	tax_registration_reason_code VARCHAR(9) NOT NULL,
	primary_state_registration_number VARCHAR(15) NOT NULL,
	current_account_number VARCHAR(20) NOT NULL,
	correspondent_account_number VARCHAR(20) NOT NULL,
	bank_identifier_code VARCHAR(9) NOT NULL,
    image LONGBLOB
);

CREATE TABLE roles(
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(45) UNIQUE NOT NULL
);

CREATE TABLE persons(
    id INT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(45) NOT NULL,
    last_name VARCHAR(45) NOT NULL,
    patronymic VARCHAR(45),
    passport_series CHAR(4) NOT NULL,
    passport_number CHAR(6) NOT NULL,
    email VARCHAR(255),
    birth_date DATE
);

CREATE TABLE users(
	id INT PRIMARY KEY AUTO_INCREMENT,
    person_id INT,
    role_id INT NOT NULL,
	airline_id INT,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    #legal_address VARCHAR(255),
    #actual_address VARCHAR(255),
    email_confirmation_code_hash VARCHAR(255),
    email_confirmation_code_expires_at_utc DATETIME,
    is_email_confirmed BOOLEAN NOT NULL,
    is_active BOOLEAN NOT NULL,
    FOREIGN KEY (person_id) REFERENCES persons(id),
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (airline_id) REFERENCES airlines(id)
);

CREATE TABLE planes(
    id INT PRIMARY KEY AUTO_INCREMENT,
    airline_id INT NOT NULL,
    model_name VARCHAR(45) NOT NULL,
    max_distance INT NOT NULL,
    passanger_capacity INT NOT NULL,
    cruising_speed INT NOT NULL,
    cost_per_kilometer INT NOT NULL,
    flight_hour_cost INT NOT NULL,
    image LONGBLOB,
    FOREIGN KEY (airline_id) REFERENCES airlines(id)
);

CREATE TABLE airports(
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(225) NOT NULL,
    city VARCHAR(45),
    country VARCHAR(45) NOT NULL,
    iata VARCHAR(3),
    icao VARCHAR(4),
    latitude DECIMAL(9, 6) NOT NULL,
    longitude DECIMAL(9, 6) NOT NULL
);

CREATE TABLE departures(
    id INT PRIMARY KEY AUTO_INCREMENT,
    charter_requester_id INT NOT NULL,
    plane_id INT NOT NULL,
    take_off_airport_id INT NOT NULL,
    landing_airport_id INT NOT NULL,
    distance INT NOT NULL,
    flight_time TIME NOT NULL,
    requested_take_off_date_time DATETIME NOT NULL,
    FOREIGN KEY (charter_requester_id) REFERENCES users(id),
    FOREIGN KEY (plane_id) REFERENCES planes(id),
    FOREIGN KEY (take_off_airport_id) REFERENCES airports(id),
    FOREIGN KEY (landing_airport_id) REFERENCES airports(id)
);

CREATE TABLE statuses(
    id INT PRIMARY KEY AUTO_INCREMENT,
    status VARCHAR(45) NOT NULL
);

CREATE TABLE departure_statuses(
	id INT PRIMARY KEY AUTO_INCREMENT,
    departure_id INT NOT NULL,
    status_id INT NOT NULL,
    status_setting_date_time DATETIME NOT NULL,
    FOREIGN KEY (departure_id) REFERENCES departures(id),
    FOREIGN KEY (status_id) REFERENCES statuses(id)
);

CREATE TABLE passenger_departure(
    departure_id INT NOT NULL,
    person_id INT NOT NULL,
    PRIMARY KEY (departure_id, person_id),
    FOREIGN KEY (departure_id) REFERENCES departures(id),
    FOREIGN KEY (person_id) REFERENCES persons(id)
);

CREATE TABLE departure_employees(
    departure_id INT NOT NULL,
    employee_id INT NOT NULL,
    PRIMARY KEY (departure_id, employee_id),
    FOREIGN KEY (departure_id) REFERENCES departures(id),
    FOREIGN KEY (employee_id) REFERENCES users(id)
);
