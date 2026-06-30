using Microsoft.AspNetCore.SignalR;

namespace ApiService.Hubs;

/// <summary>
/// SignalR hub for pushing real-time status updates to the Angular frontend.
/// </summary>
public class JarvisHub : Hub
{
    public override Task OnConnectedAsync()
    {
        Clients.Caller.SendAsync("StatusChanged", new
        {
            status = "idle",
            message = "Verbunden",
            timestamp = DateTime.UtcNow
        });
        return base.OnConnectedAsync();
    }
}
