using System.Net;
using System.Net.Mail;
using System.Text;

namespace TaskOS.Api.Services;

public interface IEmailSender
{
    Task<bool> IsConfiguredAsync();
    Task SendAsync(string toEmail, string subject, string bodyText);
}

public sealed class SmtpEmailSender : IEmailSender
{
    private readonly IAuthConfigService _authConfig;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(IAuthConfigService authConfig, ILogger<SmtpEmailSender> logger)
    {
        _authConfig = authConfig;
        _logger = logger;
    }

    public async Task<bool> IsConfiguredAsync()
    {
        var mail = await _authConfig.GetMailAsync();
        return mail.IsConfigured;
    }

    public async Task SendAsync(string toEmail, string subject, string bodyText)
    {
        var mail = await _authConfig.GetMailAsync();
        if (!mail.IsConfigured)
        {
            throw new InvalidOperationException(
                "ارسال ایمیل سیستم پیکربندی نشده است. ادمین باید از تنظیمات → ایمیل و گوگل، SMTP را تکمیل کند (مثلاً smtp.gmail.com و App Password).");
        }

        using var message = new MailMessage
        {
            From = new MailAddress(mail.From, mail.FromName, Encoding.UTF8),
            Subject = subject,
            Body = bodyText,
            BodyEncoding = Encoding.UTF8,
            SubjectEncoding = Encoding.UTF8,
            IsBodyHtml = false,
        };
        message.To.Add(new MailAddress(toEmail.Trim()));

        using var client = new SmtpClient(mail.Host, mail.Port)
        {
            EnableSsl = mail.UseSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network,
        };
        if (!string.IsNullOrWhiteSpace(mail.Username))
        {
            client.Credentials = new NetworkCredential(mail.Username, mail.Password);
        }

        try
        {
            await client.SendMailAsync(message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send mail to {Email}", toEmail);
            throw new InvalidOperationException("ارسال ایمیل ناموفق بود. تنظیمات SMTP یا رمز برنامه (App Password) را بررسی کن.");
        }
    }
}
