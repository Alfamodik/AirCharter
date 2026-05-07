INSERT INTO statuses (id, status)
VALUES (20, 'Ожидает оплаты')
ON DUPLICATE KEY UPDATE status = VALUES(status);
