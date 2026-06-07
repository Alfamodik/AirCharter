// DTO запроса UpdateDeparturePassengerRequest описывает данные, которые frontend отправляет в API для выполнения операции.

namespace AirCharter.API.Requests.Departures
{
    public sealed class UpdateDeparturePassengerRequest
    {
        public int PersonId { get; set; }
    }
}
