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

    public virtual DbSet<BankDetail> BankDetails { get; set; }

    public virtual DbSet<Departure> Departures { get; set; }

    public virtual DbSet<DepartureEmployee> DepartureEmployees { get; set; }

    public virtual DbSet<DepartureStatus> DepartureStatuses { get; set; }

    public virtual DbSet<Employee> Employees { get; set; }

    public virtual DbSet<Person> Persons { get; set; }

    public virtual DbSet<Plane> Planes { get; set; }

    public virtual DbSet<Position> Positions { get; set; }

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

            entity.HasIndex(e => e.BankDetailsId, "bank_details_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.AirlineName)
                .HasMaxLength(45)
                .HasColumnName("airline_name");
            entity.Property(e => e.BankDetailsId).HasColumnName("bank_details_id");
            entity.Property(e => e.CreationDate).HasColumnName("creation_date");
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

            entity.HasOne(d => d.BankDetails).WithMany(p => p.Airlines)
                .HasForeignKey(d => d.BankDetailsId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("airlines_ibfk_1");
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
                .HasMaxLength(45)
                .HasColumnName("name");
        });

        modelBuilder.Entity<BankDetail>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("bank_details");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.BankIdentifierCode)
                .HasMaxLength(9)
                .HasColumnName("bank_identifier_code");
            entity.Property(e => e.BankName)
                .HasMaxLength(45)
                .HasColumnName("bank_name");
            entity.Property(e => e.CorrespondentAccountNumber)
                .HasMaxLength(20)
                .HasColumnName("correspondent_account_number");
            entity.Property(e => e.CurrentAccountNumber)
                .HasMaxLength(20)
                .HasColumnName("current_account_number");
            entity.Property(e => e.PrimaryStateRegistrationNumber)
                .HasMaxLength(15)
                .HasColumnName("primary_state_registration_number");
            entity.Property(e => e.TaxRegistrationReasonCode)
                .HasMaxLength(9)
                .HasColumnName("tax_registration_reason_code");
            entity.Property(e => e.TaxpayerId)
                .HasMaxLength(12)
                .HasColumnName("taxpayer_id");
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
            entity.Property(e => e.RequestedTakeOffDateTime)
                .HasColumnType("datetime")
                .HasColumnName("requested_take_off_date_time");
            entity.Property(e => e.TakeOffAirportId).HasColumnName("take_off_airport_id");

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

        modelBuilder.Entity<DepartureEmployee>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("departure_employees");

            entity.HasIndex(e => e.DepartureId, "departure_id");

            entity.HasIndex(e => e.EmployeeId, "employee_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.DepartureId).HasColumnName("departure_id");
            entity.Property(e => e.EmployeeId).HasColumnName("employee_id");

            entity.HasOne(d => d.Departure).WithMany(p => p.DepartureEmployees)
                .HasForeignKey(d => d.DepartureId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("departure_employees_ibfk_1");

            entity.HasOne(d => d.Employee).WithMany(p => p.DepartureEmployees)
                .HasForeignKey(d => d.EmployeeId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("departure_employees_ibfk_2");
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

        modelBuilder.Entity<Employee>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("employees");

            entity.HasIndex(e => e.AirlineId, "airline_id");

            entity.HasIndex(e => e.PersonId, "person_id");

            entity.HasIndex(e => e.PositionId, "position_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.AirlineId).HasColumnName("airline_id");
            entity.Property(e => e.PersonId).HasColumnName("person_id");
            entity.Property(e => e.PositionId).HasColumnName("position_id");

            entity.HasOne(d => d.Airline).WithMany(p => p.Employees)
                .HasForeignKey(d => d.AirlineId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("employees_ibfk_3");

            entity.HasOne(d => d.Person).WithMany(p => p.Employees)
                .HasForeignKey(d => d.PersonId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("employees_ibfk_1");

            entity.HasOne(d => d.Position).WithMany(p => p.Employees)
                .HasForeignKey(d => d.PositionId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("employees_ibfk_2");
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
            entity.Property(e => e.CostPerKilometer).HasColumnName("cost_per_kilometer");
            entity.Property(e => e.CruisingSpeed).HasColumnName("cruising_speed");
            entity.Property(e => e.FlightHourCost).HasColumnName("flight_hour_cost");
            entity.Property(e => e.Image).HasColumnName("image");
            entity.Property(e => e.MaxDistance).HasColumnName("max_distance");
            entity.Property(e => e.ModelName)
                .HasMaxLength(45)
                .HasColumnName("model_name");
            entity.Property(e => e.PassangerCapacity).HasColumnName("passanger_capacity");

            entity.HasOne(d => d.Airline).WithMany(p => p.Planes)
                .HasForeignKey(d => d.AirlineId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("planes_ibfk_1");
        });

        modelBuilder.Entity<Position>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("positions");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name)
                .HasMaxLength(45)
                .HasColumnName("name");
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("roles");

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

            entity.HasIndex(e => e.BankDetailsId, "bank_details_id");

            entity.HasIndex(e => e.Email, "email").IsUnique();

            entity.HasIndex(e => e.PersonId, "person_id");

            entity.HasIndex(e => e.RoleId, "role_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ActualAddress)
                .HasMaxLength(255)
                .HasColumnName("actual_address");
            entity.Property(e => e.BankDetailsId).HasColumnName("bank_details_id");
            entity.Property(e => e.Email).HasColumnName("email");
            entity.Property(e => e.EmailConfirmationCodeExpiresAtUtc)
                .HasColumnType("datetime")
                .HasColumnName("email_confirmation_code_expires_at_utc");
            entity.Property(e => e.EmailConfirmationCodeHash)
                .HasMaxLength(255)
                .HasColumnName("email_confirmation_code_hash");
            entity.Property(e => e.IsActive).HasColumnName("is_active");
            entity.Property(e => e.IsEmailConfirmed).HasColumnName("is_email_confirmed");
            entity.Property(e => e.LegalAddress)
                .HasMaxLength(255)
                .HasColumnName("legal_address");
            entity.Property(e => e.PasswordHash)
                .HasMaxLength(255)
                .HasColumnName("password_hash");
            entity.Property(e => e.PersonId).HasColumnName("person_id");
            entity.Property(e => e.RoleId).HasColumnName("role_id");

            entity.HasOne(d => d.BankDetails).WithMany(p => p.Users)
                .HasForeignKey(d => d.BankDetailsId)
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
