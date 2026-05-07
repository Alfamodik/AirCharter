namespace AirCharter.API.Requests.Departures
{
    public sealed class UpdateManagementDepartureStatusRequest
    {
        public int StatusId { get; set; }

        public bool IncludePreviousStatuses { get; set; }

        public int? TargetLegIndex { get; set; }
    }
}
