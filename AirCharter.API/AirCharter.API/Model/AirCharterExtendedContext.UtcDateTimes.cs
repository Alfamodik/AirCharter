// Контекст EF Core описывает подключение к MySQL и наборы таблиц, с которыми работает backend.

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace AirCharter.API.Model;

public partial class AirCharterExtendedContext
{
    private static readonly ValueConverter<DateTime, DateTime> UtcDateTimeConverter = new(
        value => value,
        value => DateTime.SpecifyKind(value, DateTimeKind.Utc));

    private static readonly ValueConverter<DateTime?, DateTime?> NullableUtcDateTimeConverter = new(
        value => value,
        value => value.HasValue
            ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc)
            : null);

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AirlineNotification>(entity =>
        {
            entity.Property(notification => notification.CreatedAtUtc)
                .HasConversion(UtcDateTimeConverter);
            entity.Property(notification => notification.ReadAtUtc)
                .HasConversion(NullableUtcDateTimeConverter);
        });

        modelBuilder.Entity<Departure>(entity =>
        {
            entity.Property(departure => departure.ContractDocumentUploadedAt)
                .HasConversion(NullableUtcDateTimeConverter);
        });

        modelBuilder.Entity<DepartureStatus>(entity =>
        {
            entity.Property(departureStatus => departureStatus.StatusSettingDateTime)
                .HasConversion(UtcDateTimeConverter);
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.Property(notification => notification.CreatedAtUtc)
                .HasConversion(UtcDateTimeConverter);
            entity.Property(notification => notification.ReadAtUtc)
                .HasConversion(NullableUtcDateTimeConverter);
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.Property(refreshToken => refreshToken.CreatedAtUtc)
                .HasConversion(UtcDateTimeConverter);
            entity.Property(refreshToken => refreshToken.ExpiresAtUtc)
                .HasConversion(UtcDateTimeConverter);
            entity.Property(refreshToken => refreshToken.RevokedAtUtc)
                .HasConversion(NullableUtcDateTimeConverter);
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.Property(user => user.EmailConfirmationCodeExpiresAtUtc)
                .HasConversion(NullableUtcDateTimeConverter);
        });
    }
}
