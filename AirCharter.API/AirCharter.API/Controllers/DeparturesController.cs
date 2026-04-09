using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AirCharter.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("departures")]
    public class DeparturesController : ControllerBase
    {
        
    }
}
