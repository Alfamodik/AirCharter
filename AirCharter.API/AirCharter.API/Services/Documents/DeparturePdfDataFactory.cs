using AirCharter.API.Model;

namespace AirCharter.API.Services.Documents;

public sealed class DeparturePdfDataFactory
{
    public DeparturePdfData Create(Departure departure)
    {
        if (departure.People == null || departure.People.Count == 0)
            throw new InvalidOperationException("Для вылета отсутствуют пассажиры.");

        if (departure.Plane == null)
            throw new InvalidOperationException("Для вылета отсутствует самолёт.");

        if (departure.TakeOffAirport == null)
            throw new InvalidOperationException("Для вылета отсутствует аэропорт вылета.");

        if (departure.LandingAirport == null)
            throw new InvalidOperationException("Для вылета отсутствует аэропорт прилёта.");

        List<PassengerTicketPdfData> tickets = new List<PassengerTicketPdfData>();
        int passengerIndex = 1;

        foreach (Person person in departure.People)
        {
            PassengerTicketPdfData passengerTicketPdfData = new PassengerTicketPdfData
            {
                PassengerName = BuildPassengerName(person),
                PassengerDocument = BuildPassengerDocument(person),
                ClassName = "Чартер",
                ElectronicTicketNumber = $"AC-{departure.Id}-{passengerIndex:000}",
                BookingCode = $"BK{departure.Id:000000}",
                FlightNumber = $"CH-{departure.Id}",
                AircraftType = departure.Plane.ModelName,
                FromCity = departure.TakeOffAirport.City ?? departure.TakeOffAirport.Name,
                ToCity = departure.LandingAirport.City ?? departure.LandingAirport.Name,
                FromAirportCode = BuildAirportCode(departure.TakeOffAirport),
                ToAirportCode = BuildAirportCode(departure.LandingAirport),
                DepartureDateTime = departure.RequestedTakeOffDateTime,
                ArrivalDateTime = departure.RequestedTakeOffDateTime.Add(departure.FlightTime)
            };

            tickets.Add(passengerTicketPdfData);
            passengerIndex++;
        }

        DeparturePdfData departurePdfData = new DeparturePdfData
        {
            DepartureId = departure.Id,
            OrderNumber = departure.Id.ToString(),
            IssueDate = DateTime.UtcNow,
            PaymentMethod = "Оплата банковской картой",
            TotalPrice = departure.Price,
            CurrencySymbol = "₽",
            Tickets = tickets
        };

        return departurePdfData;
    }

    private static string BuildPassengerName(Person person)
    {
        List<string> nameParts = new List<string>();

        if (!string.IsNullOrWhiteSpace(person.LastName))
            nameParts.Add(person.LastName);

        if (!string.IsNullOrWhiteSpace(person.FirstName))
            nameParts.Add(person.FirstName);

        if (!string.IsNullOrWhiteSpace(person.Patronymic))
            nameParts.Add(person.Patronymic);

        return string.Join(" ", nameParts);
    }

    private static string BuildPassengerDocument(Person person)
    {
        return $"{person.PassportSeries} {person.PassportNumber}".Trim();
    }

    private static string BuildAirportCode(Airport airport)
    {
        if (!string.IsNullOrWhiteSpace(airport.Iata))
            return airport.Iata;

        if (!string.IsNullOrWhiteSpace(airport.Icao))
            return airport.Icao;

        return "---";
    }
}