DROP PROCEDURE IF EXISTS add_aircharter_column_if_missing;

DELIMITER //

CREATE PROCEDURE add_aircharter_column_if_missing(
    IN table_name_value varchar(64),
    IN column_name_value varchar(64),
    IN column_definition_value varchar(255)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
            AND table_name = table_name_value
            AND column_name = column_name_value
    ) THEN
        SET @ddl = CONCAT(
            'ALTER TABLE `',
            table_name_value,
            '` ADD COLUMN `',
            column_name_value,
            '` ',
            column_definition_value
        );
        PREPARE statement FROM @ddl;
        EXECUTE statement;
        DEALLOCATE PREPARE statement;
    END IF;
END//

DELIMITER ;

CALL add_aircharter_column_if_missing('persons', 'registration_address', 'varchar(255) NULL');
CALL add_aircharter_column_if_missing('persons', 'actual_address', 'varchar(255) NULL');
CALL add_aircharter_column_if_missing('persons', 'phone_number', 'varchar(20) NULL');
CALL add_aircharter_column_if_missing('persons', 'taxpayer_id', 'varchar(12) NULL');
CALL add_aircharter_column_if_missing('persons', 'bank_name', 'varchar(100) NULL');
CALL add_aircharter_column_if_missing('persons', 'current_account_number', 'varchar(20) NULL');
CALL add_aircharter_column_if_missing('persons', 'correspondent_account_number', 'varchar(20) NULL');
CALL add_aircharter_column_if_missing('persons', 'bank_identifier_code', 'varchar(9) NULL');

CALL add_aircharter_column_if_missing('airlines', 'contract_city', 'varchar(100) NULL');
CALL add_aircharter_column_if_missing('airlines', 'contract_end_date', 'date NULL');
CALL add_aircharter_column_if_missing('airlines', 'contract_validity_days', 'int NULL');
CALL add_aircharter_column_if_missing('departures', 'contract_document', 'longblob NULL');
CALL add_aircharter_column_if_missing('departures', 'contract_document_file_name', 'varchar(255) NULL');
CALL add_aircharter_column_if_missing('departures', 'contract_document_content_type', 'varchar(100) NULL');
CALL add_aircharter_column_if_missing('departures', 'contract_document_uploaded_at', 'datetime NULL');
CALL add_aircharter_column_if_missing('departures', 'contract_document_uploaded_by_user_id', 'int NULL');
CALL add_aircharter_column_if_missing('airlines', 'payment_deadline_days', 'int NULL');
CALL add_aircharter_column_if_missing('airlines', 'catering_class', 'varchar(100) NULL');
CALL add_aircharter_column_if_missing('airlines', 'passenger_arrival_hours_before_flight', 'int NULL');
CALL add_aircharter_column_if_missing('airlines', 'passenger_arrival_minutes_before_flight', 'int NULL');

UPDATE airlines
SET contract_validity_days = GREATEST(1, DATEDIFF(contract_end_date, CURRENT_DATE()))
WHERE contract_validity_days IS NULL
    AND contract_end_date IS NOT NULL;

UPDATE airlines
SET passenger_arrival_minutes_before_flight = passenger_arrival_hours_before_flight * 60
WHERE passenger_arrival_minutes_before_flight IS NULL
    AND passenger_arrival_hours_before_flight IS NOT NULL;

INSERT INTO statuses (id, status)
VALUES (19, 'Ожидает подписания договора')
ON DUPLICATE KEY UPDATE status = VALUES(status);

DROP PROCEDURE IF EXISTS add_aircharter_column_if_missing;
