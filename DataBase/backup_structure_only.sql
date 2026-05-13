-- MySQL dump 10.13  Distrib 8.0.41, for Win64 (x86_64)
--
-- Host: localhost    Database: air_charter_extended
-- ------------------------------------------------------
-- Server version	8.0.41

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `airlines`
--

DROP TABLE IF EXISTS `airlines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `airlines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `airline_name` varchar(45) NOT NULL,
  `creation_date` date NOT NULL,
  `legal_address` varchar(255) NOT NULL,
  `postal_address` varchar(255) NOT NULL,
  `phone_number` varchar(20) NOT NULL,
  `email` varchar(255) NOT NULL,
  `service_base_cost` decimal(12,2) NOT NULL,
  `transfer_base_cost` decimal(12,2) NOT NULL,
  `bank_name` varchar(45) NOT NULL,
  `taxpayer_id` varchar(12) NOT NULL,
  `tax_registration_reason_code` varchar(9) NOT NULL,
  `primary_state_registration_number` varchar(15) NOT NULL,
  `current_account_number` varchar(20) NOT NULL,
  `correspondent_account_number` varchar(20) NOT NULL,
  `bank_identifier_code` varchar(9) NOT NULL,
  `image` longblob,
  `contract_city` varchar(100) DEFAULT NULL,
  `payment_deadline_days` int DEFAULT NULL,
  `catering_class` varchar(100) DEFAULT NULL,
  `contract_validity_days` int DEFAULT NULL,
  `passenger_arrival_minutes_before_flight` int DEFAULT NULL,
  `is_catalog_visible` tinyint(1) NOT NULL DEFAULT '1',
  `organization_type` varchar(32) NOT NULL DEFAULT 'Ooo',
  PRIMARY KEY (`id`),
  UNIQUE KEY `airline_name` (`airline_name`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `airport_route_priorities`
--

DROP TABLE IF EXISTS `airport_route_priorities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `airport_route_priorities` (
  `airport_id` int NOT NULL,
  `priority_score` int NOT NULL DEFAULT '0',
  `is_capital` tinyint(1) NOT NULL DEFAULT '0',
  `is_large_city` tinyint(1) NOT NULL DEFAULT '0',
  `note` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`airport_id`),
  CONSTRAINT `airport_route_priorities_ibfk_1` FOREIGN KEY (`airport_id`) REFERENCES `airports` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `airports`
--

DROP TABLE IF EXISTS `airports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `airports` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(225) NOT NULL,
  `city` varchar(45) DEFAULT NULL,
  `country` varchar(45) NOT NULL,
  `iata` varchar(3) DEFAULT NULL,
  `icao` varchar(4) DEFAULT NULL,
  `latitude` decimal(9,6) NOT NULL,
  `longitude` decimal(9,6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7699 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `departure_employees`
--

DROP TABLE IF EXISTS `departure_employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `departure_employees` (
  `departure_id` int NOT NULL,
  `employee_id` int NOT NULL,
  PRIMARY KEY (`departure_id`,`employee_id`),
  KEY `employee_id` (`employee_id`),
  CONSTRAINT `departure_employees_ibfk_1` FOREIGN KEY (`departure_id`) REFERENCES `departures` (`id`),
  CONSTRAINT `departure_employees_ibfk_2` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `departure_route_legs`
--

DROP TABLE IF EXISTS `departure_route_legs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `departure_route_legs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `departure_id` int NOT NULL,
  `sequence_number` int NOT NULL,
  `from_airport_id` int NOT NULL,
  `to_airport_id` int NOT NULL,
  `distance` int NOT NULL,
  `flight_time` time NOT NULL,
  `flight_cost` decimal(12,2) NOT NULL,
  `ground_time_after_arrival` time DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `departure_id` (`departure_id`,`sequence_number`),
  KEY `from_airport_id` (`from_airport_id`),
  KEY `to_airport_id` (`to_airport_id`),
  CONSTRAINT `departure_route_legs_ibfk_1` FOREIGN KEY (`departure_id`) REFERENCES `departures` (`id`),
  CONSTRAINT `departure_route_legs_ibfk_2` FOREIGN KEY (`from_airport_id`) REFERENCES `airports` (`id`),
  CONSTRAINT `departure_route_legs_ibfk_3` FOREIGN KEY (`to_airport_id`) REFERENCES `airports` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=134 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `departure_statuses`
--

DROP TABLE IF EXISTS `departure_statuses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `departure_statuses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `departure_id` int NOT NULL,
  `status_id` int NOT NULL,
  `status_setting_date_time` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `departure_id` (`departure_id`),
  KEY `status_id` (`status_id`),
  CONSTRAINT `departure_statuses_ibfk_1` FOREIGN KEY (`departure_id`) REFERENCES `departures` (`id`),
  CONSTRAINT `departure_statuses_ibfk_2` FOREIGN KEY (`status_id`) REFERENCES `statuses` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=394 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `departures`
--

DROP TABLE IF EXISTS `departures`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `departures` (
  `id` int NOT NULL AUTO_INCREMENT,
  `charter_requester_id` int NOT NULL,
  `plane_id` int NOT NULL,
  `take_off_airport_id` int NOT NULL,
  `landing_airport_id` int NOT NULL,
  `distance` int NOT NULL,
  `flight_time` time NOT NULL,
  `price` decimal(12,2) NOT NULL,
  `transfers` int NOT NULL DEFAULT '0',
  `requested_take_off_date_time` datetime NOT NULL,
  `contract_document` longblob,
  `contract_document_file_name` varchar(255) DEFAULT NULL,
  `contract_document_content_type` varchar(100) DEFAULT NULL,
  `contract_document_uploaded_at` datetime DEFAULT NULL,
  `contract_document_uploaded_by_user_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `charter_requester_id` (`charter_requester_id`),
  KEY `plane_id` (`plane_id`),
  KEY `take_off_airport_id` (`take_off_airport_id`),
  KEY `landing_airport_id` (`landing_airport_id`),
  CONSTRAINT `departures_ibfk_1` FOREIGN KEY (`charter_requester_id`) REFERENCES `users` (`id`),
  CONSTRAINT `departures_ibfk_2` FOREIGN KEY (`plane_id`) REFERENCES `planes` (`id`),
  CONSTRAINT `departures_ibfk_3` FOREIGN KEY (`take_off_airport_id`) REFERENCES `airports` (`id`),
  CONSTRAINT `departures_ibfk_4` FOREIGN KEY (`landing_airport_id`) REFERENCES `airports` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=55 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `passenger_departure`
--

DROP TABLE IF EXISTS `passenger_departure`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `passenger_departure` (
  `departure_id` int NOT NULL,
  `person_id` int NOT NULL,
  PRIMARY KEY (`departure_id`,`person_id`),
  KEY `person_id` (`person_id`),
  CONSTRAINT `passenger_departure_ibfk_1` FOREIGN KEY (`departure_id`) REFERENCES `departures` (`id`),
  CONSTRAINT `passenger_departure_ibfk_2` FOREIGN KEY (`person_id`) REFERENCES `persons` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `persons`
--

DROP TABLE IF EXISTS `persons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `persons` (
  `id` int NOT NULL AUTO_INCREMENT,
  `first_name` varchar(45) NOT NULL,
  `last_name` varchar(45) NOT NULL,
  `patronymic` varchar(45) DEFAULT NULL,
  `passport_series` char(4) NOT NULL,
  `passport_number` char(6) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `registration_address` varchar(255) DEFAULT NULL,
  `actual_address` varchar(255) DEFAULT NULL,
  `phone_number` varchar(20) DEFAULT NULL,
  `taxpayer_id` varchar(12) DEFAULT NULL,
  `bank_name` varchar(100) DEFAULT NULL,
  `current_account_number` varchar(20) DEFAULT NULL,
  `correspondent_account_number` varchar(20) DEFAULT NULL,
  `bank_identifier_code` varchar(9) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `planes`
--

DROP TABLE IF EXISTS `planes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `planes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `airline_id` int NOT NULL,
  `model_name` varchar(45) NOT NULL,
  `max_distance` int NOT NULL,
  `passenger_capacity` int NOT NULL,
  `cruising_speed` int NOT NULL,
  `flight_hour_cost` decimal(12,2) NOT NULL,
  `image` longblob,
  PRIMARY KEY (`id`),
  KEY `airline_id` (`airline_id`),
  CONSTRAINT `planes_ibfk_1` FOREIGN KEY (`airline_id`) REFERENCES `airlines` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `refresh_tokens`
--

DROP TABLE IF EXISTS `refresh_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `refresh_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token_hash` varchar(128) NOT NULL,
  `created_at_utc` datetime NOT NULL,
  `expires_at_utc` datetime NOT NULL,
  `revoked_at_utc` datetime DEFAULT NULL,
  `replaced_by_token_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_hash` (`token_hash`),
  KEY `user_id` (`user_id`),
  KEY `replaced_by_token_id` (`replaced_by_token_id`),
  CONSTRAINT `refresh_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `refresh_tokens_ibfk_2` FOREIGN KEY (`replaced_by_token_id`) REFERENCES `refresh_tokens` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=339 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `statuses`
--

DROP TABLE IF EXISTS `statuses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `statuses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `status` varchar(45) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `person_id` int DEFAULT NULL,
  `role_id` int NOT NULL,
  `airline_id` int DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `email_confirmation_code_hash` varchar(255) DEFAULT NULL,
  `email_confirmation_code_expires_at_utc` datetime DEFAULT NULL,
  `is_email_confirmed` tinyint(1) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `person_id` (`person_id`),
  KEY `role_id` (`role_id`),
  KEY `airline_id` (`airline_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`person_id`) REFERENCES `persons` (`id`),
  CONSTRAINT `users_ibfk_2` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`),
  CONSTRAINT `users_ibfk_3` FOREIGN KEY (`airline_id`) REFERENCES `airlines` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-13 22:02:17
