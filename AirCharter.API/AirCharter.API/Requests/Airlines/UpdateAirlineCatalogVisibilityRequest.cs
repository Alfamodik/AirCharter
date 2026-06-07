// DTO запроса UpdateAirlineCatalogVisibilityRequest описывает данные, которые frontend отправляет в API для выполнения операции.

namespace AirCharter.API.Requests.Airlines;

public sealed class UpdateAirlineCatalogVisibilityRequest
{
    public bool IsCatalogVisible { get; set; }
}
