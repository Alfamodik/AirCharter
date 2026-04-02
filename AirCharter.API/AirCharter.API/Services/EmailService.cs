using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace AirCharter.API.Services;

public sealed class EmailService
{
    private readonly IConfiguration configuration;

    public EmailService(IConfiguration configuration)
    {
        this.configuration = configuration;
    }

    public async Task SendHtmlMessageAsync(string recipientEmail, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        string senderEmail = configuration["Smtp:Email"]
            ?? throw new InvalidOperationException("Smtp:Email is not configured.");

        string senderPassword = configuration["Smtp:Password"]
            ?? throw new InvalidOperationException("Smtp:Password is not configured.");

        string host = configuration["Smtp:Host"]
            ?? throw new InvalidOperationException("Smtp:Host is not configured.");

        string portValue = configuration["Smtp:Port"]
            ?? throw new InvalidOperationException("Smtp:Port is not configured.");

        string senderName = configuration["Smtp:SenderName"]
            ?? throw new InvalidOperationException("Smtp:SenderName is not configured.");

        bool isPortParsed = int.TryParse(portValue, out int port);

        if (!isPortParsed || port <= 0)
        {
            throw new InvalidOperationException("Smtp:Port must be a positive integer.");
        }

        MimeMessage mimeMessage = new MimeMessage();

        mimeMessage.From.Add(new MailboxAddress(senderName, senderEmail));
        mimeMessage.To.Add(MailboxAddress.Parse(recipientEmail));
        mimeMessage.Subject = subject;
        mimeMessage.Body = new TextPart("html")
        {
            Text = htmlBody
        };

        using SmtpClient smtpClient = new SmtpClient();

        await smtpClient.ConnectAsync(host, port, SecureSocketOptions.StartTls, cancellationToken);
        await smtpClient.AuthenticateAsync(senderEmail, senderPassword, cancellationToken);
        await smtpClient.SendAsync(mimeMessage, cancellationToken);
        await smtpClient.DisconnectAsync(true, cancellationToken);
    }
}