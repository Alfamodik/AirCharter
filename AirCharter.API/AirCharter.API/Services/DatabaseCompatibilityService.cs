using AirCharter.API.Model;
using Microsoft.EntityFrameworkCore;
using System.Data.Common;

namespace AirCharter.API.Services;

public sealed class DatabaseCompatibilityService(AirCharterExtendedContext context)
{
    private readonly AirCharterExtendedContext _context = context;

    public async Task EnsureAsync(CancellationToken cancellationToken = default)
    {
        await EnsureColumnAsync(
            "persons",
            "registration_address",
            "varchar(255) NULL",
            cancellationToken);
        await EnsureColumnAsync(
            "persons",
            "actual_address",
            "varchar(255) NULL",
            cancellationToken);
        await EnsureColumnAsync(
            "persons",
            "phone_number",
            "varchar(20) NULL",
            cancellationToken);
        await EnsureColumnAsync(
            "persons",
            "taxpayer_id",
            "varchar(12) NULL",
            cancellationToken);
        await EnsureColumnAsync(
            "persons",
            "bank_name",
            "varchar(100) NULL",
            cancellationToken);
        await EnsureColumnAsync(
            "persons",
            "current_account_number",
            "varchar(20) NULL",
            cancellationToken);
        await EnsureColumnAsync(
            "persons",
            "correspondent_account_number",
            "varchar(20) NULL",
            cancellationToken);
        await EnsureColumnAsync(
            "persons",
            "bank_identifier_code",
            "varchar(9) NULL",
            cancellationToken);

        await EnsureNotificationsTableAsync(cancellationToken);
        await EnsureAirlineNotificationsTableAsync(cancellationToken);
        await EnsureColumnAsync(
            "notifications",
            "action_type",
            "varchar(100) NULL",
            cancellationToken);
        await EnsureColumnAsync(
            "notifications",
            "airline_id",
            "int NULL",
            cancellationToken);
        await EnsureColumnAsync(
            "notifications",
            "role_id",
            "int NULL",
            cancellationToken);

        await EnsureColumnAsync(
            "airlines",
            "contract_city",
            "varchar(100) NULL",
            cancellationToken);
        await EnsureColumnAsync(
            "airlines",
            "contract_validity_days",
            "int NULL",
            cancellationToken);
        await EnsureColumnAsync(
            "airlines",
            "payment_deadline_days",
            "int NULL",
            cancellationToken);
        await EnsureColumnAsync(
            "airlines",
            "catering_class",
            "varchar(100) NULL",
            cancellationToken);
        await EnsureColumnAsync(
            "airlines",
            "passenger_arrival_minutes_before_flight",
            "int NULL",
            cancellationToken);
        await EnsureColumnAsync(
            "airlines",
            "is_catalog_visible",
            "tinyint(1) NOT NULL DEFAULT 1",
            cancellationToken);

        await EnsureColumnAsync(
            "airlines",
            "organization_type",
            "varchar(32) NOT NULL DEFAULT 'Ooo'",
            cancellationToken);

        await BackfillAirlineOrganizationTypeAsync(cancellationToken);

        await DropIndexIfExistsAsync(
            "airlines",
            "organization_full_name",
            cancellationToken);
        await DropIndexIfExistsAsync(
            "airlines",
            "organization_short_name",
            cancellationToken);
        await DropColumnIfExistsAsync(
            "airlines",
            "organization_full_name",
            cancellationToken);
        await DropColumnIfExistsAsync(
            "airlines",
            "organization_short_name",
            cancellationToken);

        await EnsureColumnAsync(
            "departures",
            "contract_document",
            "longblob NULL",
            cancellationToken);
        await EnsureColumnAsync(
            "departures",
            "contract_document_file_name",
            "varchar(255) NULL",
            cancellationToken);
        await EnsureColumnAsync(
            "departures",
            "contract_document_content_type",
            "varchar(100) NULL",
            cancellationToken);
        await EnsureColumnAsync(
            "departures",
            "contract_document_uploaded_at",
            "datetime NULL",
            cancellationToken);
        await EnsureColumnAsync(
            "departures",
            "contract_document_uploaded_by_user_id",
            "int NULL",
            cancellationToken);

        if (await ColumnExistsAsync("airlines", "contract_end_date", cancellationToken))
        {
            await _context.Database.ExecuteSqlRawAsync(
                """
                UPDATE airlines
                SET contract_validity_days = GREATEST(1, DATEDIFF(contract_end_date, CURRENT_DATE()))
                WHERE contract_validity_days IS NULL
                    AND contract_end_date IS NOT NULL
                """,
                cancellationToken);

            await DropColumnAsync("airlines", "contract_end_date", cancellationToken);
        }

        if (await ColumnExistsAsync("airlines", "passenger_arrival_hours_before_flight", cancellationToken))
        {
            await _context.Database.ExecuteSqlRawAsync(
                """
                UPDATE airlines
                SET passenger_arrival_minutes_before_flight = passenger_arrival_hours_before_flight * 60
                WHERE passenger_arrival_minutes_before_flight IS NULL
                    AND passenger_arrival_hours_before_flight IS NOT NULL
                """,
                cancellationToken);

            await DropColumnAsync("airlines", "passenger_arrival_hours_before_flight", cancellationToken);
        }

        await _context.Database.ExecuteSqlRawAsync(
            """
            INSERT INTO statuses (id, status)
            VALUES
                (19, 'Ожидает подписания договора'),
                (20, 'Ожидает оплаты'),
                (21, 'На промежуточной посадке')
            ON DUPLICATE KEY UPDATE status = VALUES(status)
            """,
            cancellationToken);
    }

    private async Task EnsureColumnAsync(
        string tableName,
        string columnName,
        string columnDefinition,
        CancellationToken cancellationToken)
    {
        if (await ColumnExistsAsync(tableName, columnName, cancellationToken))
            return;

        DbConnection connection = _context.Database.GetDbConnection();

        await using DbCommand alterCommand = connection.CreateCommand();
        alterCommand.CommandText = $"ALTER TABLE `{tableName}` ADD COLUMN `{columnName}` {columnDefinition}";
        await alterCommand.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task EnsureNotificationsTableAsync(CancellationToken cancellationToken)
    {
        if (await TableExistsAsync("notifications", cancellationToken))
            return;

        await _context.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE notifications (
                id int NOT NULL AUTO_INCREMENT,
                user_id int NOT NULL,
                title varchar(255) NOT NULL,
                message varchar(1000) NOT NULL,
                action_type varchar(100) NULL,
                airline_id int NULL,
                role_id int NULL,
                created_at_utc datetime NOT NULL,
                read_at_utc datetime NULL,
                PRIMARY KEY (id),
                KEY user_id (user_id),
                KEY airline_id (airline_id),
                KEY role_id (role_id),
                CONSTRAINT notifications_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id)
            )
            """,
            cancellationToken);
    }

    private async Task EnsureAirlineNotificationsTableAsync(CancellationToken cancellationToken)
    {
        if (await TableExistsAsync("airline_notifications", cancellationToken))
            return;

        await _context.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE airline_notifications (
                id int NOT NULL AUTO_INCREMENT,
                airline_id int NOT NULL,
                title varchar(255) NOT NULL,
                message varchar(1000) NOT NULL,
                created_at_utc datetime NOT NULL,
                read_at_utc datetime NULL,
                PRIMARY KEY (id),
                KEY airline_id (airline_id),
                CONSTRAINT airline_notifications_ibfk_1 FOREIGN KEY (airline_id) REFERENCES airlines (id)
            )
            """,
            cancellationToken);
    }

    private async Task DropColumnAsync(
        string tableName,
        string columnName,
        CancellationToken cancellationToken)
    {
        DbConnection connection = _context.Database.GetDbConnection();

        await using DbCommand alterCommand = connection.CreateCommand();
        alterCommand.CommandText = $"ALTER TABLE `{tableName}` DROP COLUMN `{columnName}`";
        await alterCommand.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task DropColumnIfExistsAsync(
        string tableName,
        string columnName,
        CancellationToken cancellationToken)
    {
        if (!await ColumnExistsAsync(tableName, columnName, cancellationToken))
            return;

        await DropColumnAsync(tableName, columnName, cancellationToken);
    }

    private async Task BackfillAirlineOrganizationTypeAsync(CancellationToken cancellationToken)
    {
        if (!await ColumnExistsAsync("airlines", "organization_full_name", cancellationToken) &&
            !await ColumnExistsAsync("airlines", "organization_short_name", cancellationToken))
            return;

        await _context.Database.ExecuteSqlRawAsync(
            """
            UPDATE airlines
            SET organization_type = CASE
                WHEN organization_short_name = 'ООО' OR organization_full_name LIKE 'Общество с ограниченной ответственностью%' THEN 'Ooo'
                WHEN organization_short_name = 'ПАО' OR organization_full_name LIKE 'Публичное акционерное общество%' THEN 'Pao'
                WHEN organization_short_name = 'АО' OR organization_full_name LIKE 'Акционерное общество%' THEN 'Ao'
                WHEN organization_short_name = 'ЗАО' OR organization_full_name LIKE 'Закрытое акционерное общество%' THEN 'Zao'
                WHEN organization_short_name = 'ОАО' OR organization_full_name LIKE 'Открытое акционерное общество%' THEN 'Oao'
                WHEN organization_short_name = 'ИП' OR organization_full_name LIKE 'Индивидуальный предприниматель%' THEN 'Ip'
                ELSE 'Ooo'
            END
            """,
            cancellationToken);
    }

    private async Task DropIndexIfExistsAsync(
        string tableName,
        string indexName,
        CancellationToken cancellationToken)
    {
        if (!await IndexExistsAsync(tableName, indexName, cancellationToken))
            return;

        DbConnection connection = _context.Database.GetDbConnection();

        await using DbCommand alterCommand = connection.CreateCommand();
        alterCommand.CommandText = $"ALTER TABLE `{tableName}` DROP INDEX `{indexName}`";
        await alterCommand.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task<bool> ColumnExistsAsync(
        string tableName,
        string columnName,
        CancellationToken cancellationToken)
    {
        DbConnection connection = _context.Database.GetDbConnection();

        if (connection.State != System.Data.ConnectionState.Open)
            await connection.OpenAsync(cancellationToken);

        await using DbCommand checkCommand = connection.CreateCommand();
        checkCommand.CommandText =
            """
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
                AND table_name = @tableName
                AND column_name = @columnName
            """;

        AddParameter(checkCommand, "@tableName", tableName);
        AddParameter(checkCommand, "@columnName", columnName);

        object? result = await checkCommand.ExecuteScalarAsync(cancellationToken);

        return Convert.ToInt32(result) > 0;
    }

    private async Task<bool> TableExistsAsync(
        string tableName,
        CancellationToken cancellationToken)
    {
        DbConnection connection = _context.Database.GetDbConnection();

        if (connection.State != System.Data.ConnectionState.Open)
            await connection.OpenAsync(cancellationToken);

        await using DbCommand checkCommand = connection.CreateCommand();
        checkCommand.CommandText =
            """
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
                AND table_name = @tableName
            """;

        AddParameter(checkCommand, "@tableName", tableName);

        object? result = await checkCommand.ExecuteScalarAsync(cancellationToken);

        return Convert.ToInt32(result) > 0;
    }

    private async Task<bool> IndexExistsAsync(
        string tableName,
        string indexName,
        CancellationToken cancellationToken)
    {
        DbConnection connection = _context.Database.GetDbConnection();

        if (connection.State != System.Data.ConnectionState.Open)
            await connection.OpenAsync(cancellationToken);

        await using DbCommand checkCommand = connection.CreateCommand();
        checkCommand.CommandText =
            """
            SELECT COUNT(*)
            FROM information_schema.statistics
            WHERE table_schema = DATABASE()
                AND table_name = @tableName
                AND index_name = @indexName
            """;

        AddParameter(checkCommand, "@tableName", tableName);
        AddParameter(checkCommand, "@indexName", indexName);

        object? result = await checkCommand.ExecuteScalarAsync(cancellationToken);

        return Convert.ToInt32(result) > 0;
    }

    private static void AddParameter(DbCommand command, string name, object value)
    {
        DbParameter parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }
}
