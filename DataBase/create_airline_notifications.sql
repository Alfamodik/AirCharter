CREATE TABLE IF NOT EXISTS `airline_notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `airline_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` varchar(1000) NOT NULL,
  `created_at_utc` datetime NOT NULL,
  `read_at_utc` datetime NULL,
  PRIMARY KEY (`id`),
  KEY `airline_id` (`airline_id`),
  CONSTRAINT `airline_notifications_ibfk_1` FOREIGN KEY (`airline_id`) REFERENCES `airlines` (`id`)
);
