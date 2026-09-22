namespace TaskOS.Api.Dtos;

public sealed class LoginRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public sealed class AuthMeDto
{
    public bool Authenticated { get; set; }
    public string? Username { get; set; }
    public string? DisplayName { get; set; }
    public string? Email { get; set; }
    public string Role { get; set; } = "User";
    public bool IsAdmin { get; set; }
    public bool MustChangePassword { get; set; }
    public string? NtfyTopic { get; set; }
}

public sealed class AppUserDto
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? NtfyTopic { get; set; }
    public string Role { get; set; } = "User";
    public string CreatedAt { get; set; } = string.Empty;
    public bool HasGoogle { get; set; }
    public bool MustChangePassword { get; set; }
}

public sealed class CreateUserRequest
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? NtfyTopic { get; set; }
    public string? Role { get; set; }
}

public sealed class UpdateUserRequest
{
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Username { get; set; }
    public string? Email { get; set; }
    public string? NtfyTopic { get; set; }
    public string? Password { get; set; }
    public string? Role { get; set; }
}

public sealed class ForgotPasswordRequest
{
    public string? Email { get; set; }
    public string? UsernameOrEmail { get; set; }
}

public sealed class ChangePasswordRequest
{
    public string? CurrentPassword { get; set; }
    public string NewPassword { get; set; } = string.Empty;
}

public sealed class UpdateMyNtfyTopicRequest
{
    public string? NtfyTopic { get; set; }
}

public sealed class AuthProvidersDto
{
    public bool Google { get; set; }
    public bool PasswordReset { get; set; }
    public string? GoogleClientId { get; set; }
}

public sealed class GoogleIdTokenRequest
{
    public string? IdToken { get; set; }
}

public sealed class ResetPasswordWithTempRequest
{
    public string? Email { get; set; }
    public string? TempPassword { get; set; }
    public string? NewPassword { get; set; }
}
