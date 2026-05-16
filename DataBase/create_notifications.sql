CREATE TABLE IF NOT EXISTS `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` varchar(1000) NOT NULL,
  `action_type` varchar(100) NULL,
  `airline_id` int NULL,
  `role_id` int NULL,
  `created_at_utc` datetime NOT NULL,
  `read_at_utc` datetime NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `airline_id` (`airline_id`),
  KEY `role_id` (`role_id`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
);
