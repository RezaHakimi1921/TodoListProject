namespace TaskOS.Api.Dtos;

public sealed class AuthSystemConfigDto
{
    public string MailHost { get; set; } = string.Empty;
    public int MailPort { get; set; } = 587;
    public bool MailUseSsl { get; set; } = true;
    public string MailUsername { get; set; } = string.Empty;
    public string MailFrom { get; set; } = string.Empty;
    public string MailFromName { get; set; } = "TaskOS";
    public bool MailConfigured { get; set; }
    public bool HasMailPassword { get; set; }
    public string GoogleClientId { get; set; } = string.Empty;
    public bool GoogleConfigured { get; set; }
    public bool HasGoogleClientSecret { get; set; }
}

public sealed class UpdateAuthSystemConfigRequest
{
    public string? MailHost { get; set; }
    public int MailPort { get; set; } = 587;
    public bool MailUseSsl { get; set; } = true;
    public string? MailUsername { get; set; }
    public string? MailPassword { get; set; }
    public string? MailFrom { get; set; }
    public string? MailFromName { get; set; }
    public string? GoogleClientId { get; set; }
    public string? GoogleClientSecret { get; set; }
}
