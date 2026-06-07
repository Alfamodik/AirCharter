// DTO ответа FlightCostResponse описывает данные, которые API возвращает frontend после обработки запроса.

namespace AirCharter.API.Responses.Departures
{
    public sealed class FlightCostResponse
    {
        public decimal Cost { get; set; }
    }
}
