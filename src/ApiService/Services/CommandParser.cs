using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Extensions.Logging;

namespace ApiService.Services;

/// <summary>
/// Parser to intercept voice and text commands for local system execution (superpowers).
/// </summary>
public class CommandParser(ILogger<CommandParser> logger)
{
    public bool TryHandleCommand(string text, out string response)
    {
        response = string.Empty;
        if (string.IsNullOrWhiteSpace(text))
        {
            return false;
        }

        var normalized = text.ToLowerInvariant();

        // Check for commands to open Google Chrome
        if (normalized.Contains("öffne chrome") || 
            normalized.Contains("starte chrome") || 
            normalized.Contains("google chrome öffnen") || 
            normalized.Contains("google chrome starten") || 
            normalized.Contains("open chrome") || 
            normalized.Contains("start chrome"))
        {
            if (OpenChrome())
            {
                response = "Ich habe Google Chrome für dich geöffnet.";
                return true;
            }
            else
            {
                response = "Ich konnte Google Chrome leider nicht öffnen.";
                return true;
            }
        }

        return false;
    }

    private bool OpenChrome()
    {
        try
        {
            if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
            {
                logger.LogInformation("Opening Google Chrome on macOS");
                Process.Start(new ProcessStartInfo
                {
                    FileName = "open",
                    ArgumentList = { "-a", "Google Chrome" },
                    UseShellExecute = false
                });
                return true;
            }
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                logger.LogInformation("Opening Google Chrome on Windows");
                Process.Start(new ProcessStartInfo
                {
                    FileName = "chrome.exe",
                    UseShellExecute = true
                });
                return true;
            }
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
            {
                logger.LogInformation("Opening Google Chrome on Linux");
                Process.Start(new ProcessStartInfo
                {
                    FileName = "google-chrome",
                    UseShellExecute = true
                });
                return true;
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to open Google Chrome");
        }
        return false;
    }
}
