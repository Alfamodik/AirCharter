// DTO запроса UpdateDepartureTakeOffDateTimeRequest описывает данные, которые frontend отправляет в API для выполнения операции.

namespace AirCharter.API.Requests.Departures
{
    public sealed class UpdateDepartureTakeOffDateTimeRequest
    {
        public DateTime RequestedTakeOffDateTime { get; init; }
    }
}
