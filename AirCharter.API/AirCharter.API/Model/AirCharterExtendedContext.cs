using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using Pomelo.EntityFrameworkCore.MySql.Scaffolding.Internal;

namespace AirCharter.API.Model;

public partial class AirCharterExtendedContext : DbContext
{
    public AirCharterExtendedContext()
    {
    }

    public AirCharterExtendedContext(DbContextOptions<AirCharterExtendedContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Airline> Airlines { get; set; }

    public virtual DbSet<Airport> Airports { get; set; }

    public virtual DbSet<Departure> Departures { get; set; }

    public virtual DbSet<DepartureRouteLeg> DepartureRouteLegs { get; set; }

    public virtual DbSet<DepartureStatus> DepartureStatuses { get; set; }

    public virtual DbSet<Person> Persons { get; set; }

    public virtual DbSet<Plane> Planes { get; set; }

    public virtual DbSet<RefreshToken> RefreshTokens { get; set; }

    public virtual DbSet<Role> Roles { get; set; }

    public virtual DbSet<Status> Statuses { get; set; }

    public virtual DbSet<User> Users { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder
            .UseCollation("utf8mb4_0900_ai_ci")
            .HasCharSet("utf8mb4");

        modelBuilder.Entity<Airline>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("airlines");

            entity.HasIndex(e => e.AirlineName, "airline_name").IsUnique();

            entity.HasIndex(e => e.OrganizationFullName, "organization_full_name").IsUnique();

            entity.HasIndex(e => e.OrganizationShortName, "organization_short_name").IsUnique();

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.AirlineName)
                .HasMaxLength(45)
                .HasColumnName("airline_name");
            entity.Property(e => e.BankIdentifierCode)
                .HasMaxLength(9)
                .HasColumnName("bank_identifier_code");
            entity.Property(e => e.BankName)
                .HasMaxLength(45)
                .HasColumnName("bank_name");
            entity.Property(e => e.CorrespondentAccountNumber)
                .HasMaxLength(20)
                .HasColumnName("correspondent_account_number");
            entity.Property(e => e.CreationDate).HasColumnName("creation_date");
            entity.Property(e => e.CurrentAccountNumber)
                .HasMaxLength(20)
                .HasColumnName("current_account_number");
            entity.Property(e => e.Email)
                .HasMaxLength(255)
                .HasColumnName("email");
            entity.Property(e => e.Image).HasColumnName("image");
            entity.Property(e => e.LegalAddress)
                .HasMaxLength(255)
                .HasColumnName("legal_address");
            entity.Property(e => e.OrganizationFullName)
                .HasMaxLength(100)
                .HasColumnName("organization_full_name");
            entity.Property(e => e.OrganizationShortName)
                .HasMaxLength(100)
                .HasColumnName("organization_short_name");
            entity.Property(e => e.PhoneNumber)
                .HasMaxLength(20)
                .HasColumnName("phone_number");
            entity.Property(e => e.PostalAddress)
                .HasMaxLength(255)
                .HasColumnName("postal_address");
            entity.Property(e => e.PrimaryStateRegistrationNumber)
                .HasMaxLength(15)
                .HasColumnName("primary_state_registration_number");
            entity.Property(e => e.ServiceBaseCost)
                .HasPrecision(12, 2)
                .HasColumnName("service_base_cost");
            entity.Property(e => e.TaxRegistrationReasonCode)
                .HasMaxLength(9)
                .HasColumnName("tax_registration_reason_code");
            entity.Property(e => e.TaxpayerId)
                .HasMaxLength(12)
                .HasColumnName("taxpayer_id");
            entity.Property(e => e.TransferBaseCost)
                .HasPrecision(12, 2)
                .HasColumnName("transfer_base_cost");
        });

        modelBuilder.Entity<Airport>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("airports");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.City)
                .HasMaxLength(45)
                .HasColumnName("city");
            entity.Property(e => e.Country)
                .HasMaxLength(45)
                .HasColumnName("country");
            entity.Property(e => e.Iata)
                .HasMaxLength(3)
                .HasColumnName("iata");
            entity.Property(e => e.Icao)
                .HasMaxLength(4)
                .HasColumnName("icao");
            entity.Property(e => e.Latitude)
                .HasPrecision(9, 6)
                .HasColumnName("latitude");
            entity.Property(e => e.Longitude)
                .HasPrecision(9, 6)
                .HasColumnName("longitude");
            entity.Property(e => e.Name)
                .HasMaxLength(225)
                .HasColumnName("name");
        });

        modelBuilder.Entity<Departure>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("departures");

            entity.HasIndex(e => e.CharterRequesterId, "charter_requester_id");

            entity.HasIndex(e => e.LandingAirportId, "landing_airport_id");

            entity.HasIndex(e => e.PlaneId, "plane_id");

            entity.HasIndex(e => e.TakeOffAirportId, "take_off_airport_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CharterRequesterId).HasColumnName("charter_requester_id");
            entity.Property(e => e.Distance).HasColumnName("distance");
            entity.Property(e => e.FlightTime)
                .HasColumnType("time")
                .HasColumnName("flight_time");
            entity.Property(e => e.LandingAirportId).HasColumnName("landing_airport_id");
            entity.Property(e => e.PlaneId).HasColumnName("plane_id");
            entity.Property(e => e.Price)
                .HasPrecision(12, 2)
                .HasColumnName("price");
            entity.Property(e => e.RequestedTakeOffDateTime)
                .HasColumnType("datetime")
                .HasColumnName("requested_take_off_date_time");
            entity.Property(e => e.TakeOffAirportId).HasColumnName("take_off_airport_id");
            entity.Property(e => e.Transfers).HasColumnName("transfers");

            entity.HasOne(d => d.CharterRequester).WithMany(p => p.Departures)
                .HasForeignKey(d => d.CharterRequesterId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("departures_ibfk_1");

            entity.HasOne(d => d.LandingAirport).WithMany(p => p.DepartureLandingAirports)
                .HasForeignKey(d => d.LandingAirportId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("departures_ibfk_4");

            entity.HasOne(d => d.Plane).WithMany(p => p.Departures)
                .HasForeignKey(d => d.PlaneId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("departures_ibfk_2");

            entity.HasOne(d => d.TakeOffAirport).WithMany(p => p.DepartureTakeOffAirports)
                .HasForeignKey(d => d.TakeOffAirportId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("departures_ibfk_3");

            entity.HasMany(d => d.Employees).WithMany(p => p.DeparturesNavigation)
                .UsingEntity<Dictionary<string, object>>(
                    "DepartureEmployee",
                    r => r.HasOne<User>().WithMany()
                        .HasForeignKey("EmployeeId")
                        .OnDelete(DeleteBehavior.ClientSetNull)
                        .HasConstraintName("departure_employees_ibfk_2"),
                    l => l.HasOne<Departure>().WithMany()
                        .HasForeignKey("DepartureId")
                        .OnDelete(DeleteBehavior.ClientSetNull)
                        .HasConstraintName("departure_employees_ibfk_1"),
                    j =>
                    {
                        j.HasKey("DepartureId", "EmployeeId")
                            .HasName("PRIMARY")
                            .HasAnnotation("MySql:IndexPrefixLength", new[] { 0, 0 });
                        j.ToTable("departure_employees");
                        j.HasIndex(new[] { "EmployeeId" }, "employee_id");
                        j.IndexerProperty<int>("DepartureId").HasColumnName("departure_id");
                        j.IndexerProperty<int>("EmployeeId").HasColumnName("employee_id");
                    });

            entity.HasMany(d => d.People).WithMany(p => p.Departures)
                .UsingEntity<Dictionary<string, object>>(
                    "PassengerDeparture",
                    r => r.HasOne<Person>().WithMany()
                        .HasForeignKey("PersonId")
                        .OnDelete(DeleteBehavior.ClientSetNull)
                        .HasConstraintName("passenger_departure_ibfk_2"),
                    l => l.HasOne<Departure>().WithMany()
                        .HasForeignKey("DepartureId")
                        .OnDelete(DeleteBehavior.ClientSetNull)
                        .HasConstraintName("passenger_departure_ibfk_1"),
                    j =>
                    {
                        j.HasKey("DepartureId", "PersonId")
                            .HasName("PRIMARY")
                            .HasAnnotation("MySql:IndexPrefixLength", new[] { 0, 0 });
                        j.ToTable("passenger_departure");
                        j.HasIndex(new[] { "PersonId" }, "person_id");
                        j.IndexerProperty<int>("DepartureId").HasColumnName("departure_id");
                        j.IndexerProperty<int>("PersonId").HasColumnName("person_id");
                    });
        });

        modelBuilder.Entity<DepartureRouteLeg>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("departure_route_legs");

            entity.HasIndex(e => new { e.DepartureId, e.SequenceNumber }, "departure_id").IsUnique();

            entity.HasIndex(e => e.FromAirportId, "from_airport_id");

            entity.HasIndex(e => e.ToAirportId, "to_airport_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.DepartureId).HasColumnName("departure_id");
            entity.Property(e => e.Distance).HasColumnName("distance");
            entity.Property(e => e.FlightCost)
                .HasPrecision(12, 2)
                .HasColumnName("flight_cost");
            entity.Property(e => e.FlightTime)
                .HasColumnType("time")
                .HasColumnName("flight_time");
            entity.Property(e => e.FromAirportId).HasColumnName("from_airport_id");
            entity.Property(e => e.GroundTimeAfterArrival)
                .HasColumnType("time")
                .HasColumnName("ground_time_after_arrival");
            entity.Property(e => e.SequenceNumber).HasColumnName("sequence_number");
            entity.Property(e => e.ToAirportId).HasColumnName("to_airport_id");

            entity.HasOne(d => d.Departure).WithMany(p => p.DepartureRouteLegs)
                .HasForeignKey(d => d.DepartureId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("departure_route_legs_ibfk_1");

            entity.HasOne(d => d.FromAirport).WithMany(p => p.DepartureRouteLegFromAirports)
                .HasForeignKey(d => d.FromAirportId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("departure_route_legs_ibfk_2");

            entity.HasOne(d => d.ToAirport).WithMany(p => p.DepartureRouteLegToAirports)
                .HasForeignKey(d => d.ToAirportId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("departure_route_legs_ibfk_3");
        });

        modelBuilder.Entity<DepartureStatus>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("departure_statuses");

            entity.HasIndex(e => e.DepartureId, "departure_id");

            entity.HasIndex(e => e.StatusId, "status_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.DepartureId).HasColumnName("departure_id");
            entity.Property(e => e.StatusId).HasColumnName("status_id");
            entity.Property(e => e.StatusSettingDateTime)
                .HasColumnType("datetime")
                .HasColumnName("status_setting_date_time");

            entity.HasOne(d => d.Departure).WithMany(p => p.DepartureStatuses)
                .HasForeignKey(d => d.DepartureId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("departure_statuses_ibfk_1");

            entity.HasOne(d => d.Status).WithMany(p => p.DepartureStatuses)
                .HasForeignKey(d => d.StatusId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("departure_statuses_ibfk_2");
        });

        modelBuilder.Entity<Person>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("persons");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.BirthDate).HasColumnName("birth_date");
            entity.Property(e => e.Email)
                .HasMaxLength(255)
                .HasColumnName("email");
            entity.Property(e => e.FirstName)
                .HasMaxLength(45)
                .HasColumnName("first_name");
            entity.Property(e => e.LastName)
                .HasMaxLength(45)
                .HasColumnName("last_name");
            entity.Property(e => e.PassportNumber)
                .HasMaxLength(6)
                .IsFixedLength()
                .HasColumnName("passport_number");
            entity.Property(e => e.PassportSeries)
                .HasMaxLength(4)
                .IsFixedLength()
                .HasColumnName("passport_series");
            entity.Property(e => e.Patronymic)
                .HasMaxLength(45)
                .HasColumnName("patronymic");
        });

        modelBuilder.Entity<Plane>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("planes");

            entity.HasIndex(e => e.AirlineId, "airline_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.AirlineId).HasColumnName("airline_id");
            entity.Property(e => e.CruisingSpeed).HasColumnName("cruising_speed");
            entity.Property(e => e.FlightHourCost)
                .HasPrecision(12, 2)
                .HasColumnName("flight_hour_cost");
            entity.Property(e => e.Image).HasColumnName("image");
            entity.Property(e => e.MaxDistance).HasColumnName("max_distance");
            entity.Property(e => e.ModelName)
                .HasMaxLength(45)
                .HasColumnName("model_name");
            entity.Property(e => e.PassengerCapacity).HasColumnName("passenger_capacity");

            entity.HasOne(d => d.Airline).WithMany(p => p.Planes)
                .HasForeignKey(d => d.AirlineId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("planes_ibfk_1");
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("refresh_tokens");

            entity.HasIndex(e => e.ReplacedByTokenId, "replaced_by_token_id");

            entity.HasIndex(e => e.TokenHash, "token_hash").IsUnique();

            entity.HasIndex(e => e.UserId, "user_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAtUtc)
                .HasColumnType("datetime")
                .HasColumnName("created_at_utc");
            entity.Property(e => e.ExpiresAtUtc)
                .HasColumnType("datetime")
                .HasColumnName("expires_at_utc");
            entity.Property(e => e.ReplacedByTokenId).HasColumnName("replaced_by_token_id");
            entity.Property(e => e.RevokedAtUtc)
                .HasColumnType("datetime")
                .HasColumnName("revoked_at_utc");
            entity.Property(e => e.TokenHash)
                .HasMaxLength(128)
                .HasColumnName("token_hash");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.ReplacedByToken).WithMany(p => p.ReplacedRefreshTokens)
                .HasForeignKey(d => d.ReplacedByTokenId)
                .HasConstraintName("refresh_tokens_ibfk_2");

            entity.HasOne(d => d.User).WithMany(p => p.RefreshTokens)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("refresh_tokens_ibfk_1");
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("roles");

            entity.HasIndex(e => e.Name, "name").IsUnique();

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name)
                .HasMaxLength(45)
                .HasColumnName("name");
        });

        modelBuilder.Entity<Status>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("statuses");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Status1)
                .HasMaxLength(45)
                .HasColumnName("status");
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("users");

            entity.HasIndex(e => e.AirlineId, "airline_id");

            entity.HasIndex(e => e.Email, "email").IsUnique();

            entity.HasIndex(e => e.PersonId, "person_id");

            entity.HasIndex(e => e.RoleId, "role_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.AirlineId).HasColumnName("airline_id");
            entity.Property(e => e.Email).HasColumnName("email");
            entity.Property(e => e.EmailConfirmationCodeExpiresAtUtc)
                .HasColumnType("datetime")
                .HasColumnName("email_confirmation_code_expires_at_utc");
            entity.Property(e => e.EmailConfirmationCodeHash)
                .HasMaxLength(255)
                .HasColumnName("email_confirmation_code_hash");
            entity.Property(e => e.IsActive).HasColumnName("is_active");
            entity.Property(e => e.IsEmailConfirmed).HasColumnName("is_email_confirmed");
            entity.Property(e => e.PasswordHash)
                .HasMaxLength(255)
                .HasColumnName("password_hash");
            entity.Property(e => e.PersonId).HasColumnName("person_id");
            entity.Property(e => e.RoleId).HasColumnName("role_id");

            entity.HasOne(d => d.Airline).WithMany(p => p.Users)
                .HasForeignKey(d => d.AirlineId)
                .HasConstraintName("users_ibfk_3");

            entity.HasOne(d => d.Person).WithMany(p => p.Users)
                .HasForeignKey(d => d.PersonId)
                .HasConstraintName("users_ibfk_1");

            entity.HasOne(d => d.Role).WithMany(p => p.Users)
                .HasForeignKey(d => d.RoleId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("users_ibfk_2");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
