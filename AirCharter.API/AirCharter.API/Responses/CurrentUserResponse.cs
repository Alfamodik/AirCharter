namespace AirCharter.API.Responses
{
    public sealed class CurrentUserResponse
    {
        public int Id { get; set; }

        public string Email { get; set; } = null!;

        public bool IsEmailConfirmed { get; set; }

        public int? AirlineId { get; set; }

        public bool IsActive { get; set; }

        public CurrentUserPersonResponse? Person { get; set; }

        public CurrentUserRoleResponse Role { get; set; } = null!;
    }
}
