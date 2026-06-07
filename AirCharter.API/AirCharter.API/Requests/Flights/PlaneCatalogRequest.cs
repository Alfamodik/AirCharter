// DTO запроса PlaneCatalogRequest описывает данные, которые frontend отправляет в API для выполнения операции.

namespace AirCharter.API.Requests.Flights
{
    public sealed class PlaneCatalogRequest
    {
        public int TakeOffAirportId { get; set; }
        public int LandingAirportId { get; set; }
    }
}
