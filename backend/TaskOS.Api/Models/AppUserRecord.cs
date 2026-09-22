namespace TaskOS.Api.Models;

public sealed class AppUserRecord
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? GoogleSubject { get; set; }
    public string? NtfyTopic { get; set; }
    public string Role { get; set; } = "User";
    public int MustChangePassword { get; set; }
    public string PasswordHash { get; set; } = string.Empty;
    public string PasswordSalt { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
}