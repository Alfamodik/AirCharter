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

        await EnsureColumnAsync(
            "airlines",
            "contract_city",
            "varchar(100) NULL",
            cancellationToken);
        await EnsureColumnAsync(
            "airlines",
            "contract_end_date",
            "date NULL",
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
            "passenger_arrival_hours_before_flight",
            "int NULL",
            cancellationToken);
        await EnsureColumnAsync(
            "airlines",
            "passenger_arrival_minutes_before_flight",
            "int NULL",
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

        await _context.Database.ExecuteSqlRawAsync(
            """
            UPDATE airlines
            SET contract_validity_days = GREATEST(1, DATEDIFF(contract_end_date, CURRENT_DATE()))
            WHERE contract_validity_days IS NULL
                AND contract_end_date IS NOT NULL
            """,
            cancellationToken);

        await _context.Database.ExecuteSqlRawAsync(
            """
            UPDATE airlines
            SET passenger_arrival_minutes_before_flight = passenger_arrival_hours_before_flight * 60
            WHERE passenger_arrival_minutes_before_flight IS NULL
                AND passenger_arrival_hours_before_flight IS NOT NULL
            """,
            cancellationToken);

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

        if (Convert.ToInt32(result) > 0)
            return;

        await using DbCommand alterCommand = connection.CreateCommand();
        alterCommand.CommandText = $"ALTER TABLE `{tableName}` ADD COLUMN `{columnName}` {columnDefinition}";
        await alterCommand.ExecuteNonQueryAsync(cancellationToken);
    }

    private static void AddParameter(DbCommand command, string name, object value)
    {
        DbParameter parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }
}
