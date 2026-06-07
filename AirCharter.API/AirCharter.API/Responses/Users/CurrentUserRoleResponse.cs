// DTO ответа CurrentUserRoleResponse описывает данные, которые API возвращает frontend после обработки запроса.

namespace AirCharter.API.Responses.Users
{
    public sealed class CurrentUserRoleResponse
    {
        public int Id { get; set; }

        public string Name { get; set; } = null!;
    }
}
