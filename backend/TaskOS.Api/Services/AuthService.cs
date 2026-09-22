using System.Net;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Dapper;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using TaskOS.Api.Data;
using TaskOS.Api.Dtos;
using TaskOS.Api.Models;

namespace TaskOS.Api.Services;

public interface IAuthService
{
    Task EnsureSeedUserAsync();
    Task<bool> ValidateAsync(string username, string password);
    Task SignInAsync(HttpContext http, string username);
    Task SignOutAsync(HttpContext http);
    string? CurrentUsername(ClaimsPrincipal user);
    Task<AppUserDto?> GetByUsernameAsync(string username);
    Task<IReadOnlyList<AppUserDto>> ListUsersAsync();
    Task<AppUserDto> CreateUserAsync(CreateUserRequest request);
    Task<AppUserDto?> UpdateUserAsync(int id, UpdateUserRequest request);
    Task<bool> DeleteUserAsync(int id, string actingUsername);
    Task ForgotPasswordAsync(string email);
    Task ResetPasswordWithTempAsync(string email, string tempPassword, string newPassword);
    Task ChangePasswordAsync(string username, string? currentPassword, string newPassword);
    Task<string> UpdateMyNtfyTopicAsync(string username, string? topic);
    Task<AppUserDto> UpsertGoogleUserAsync(string googleSubject, string email, string? firstName, string? lastName);
    Task<bool> IsAdminAsync(string? username);
    Task<AuthProvidersDto> GetProvidersAsync();
}

public sealed class AuthService : IAuthService
{
    public const string CookieScheme = CookieAuthenticationDefaults.AuthenticationScheme;

    private const string SeedUsername = "reza";
    private const string SeedPassword = "rezahakimi1921";
    private const string SeedFirstName = "رضا";
    private const string SeedLastName = "حکیمی";

    private static readonly Regex EmailRegex = new(
        @"^[^@\s]+@[^@\s]+\.[^@\s]+$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private readonly SqliteConnectionFactory _factory;
    private readonly IPushNotificationService _push;

    public AuthService(SqliteConnectionFactory factory, IPushNotificationService push)
    {
        _factory = factory;
        _push = push;
    }

    public Task<AuthProvidersDto> GetProvidersAsync()
    {
        return Task.FromResult(new AuthProvidersDto
        {
            Google = false,
            PasswordReset = true,
            GoogleClientId = null,
        });
    }

    public async Task EnsureSeedUserAsync()
    {
        using var connection = _factory.Create();
        var count = await connection.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM AppUser");
        if (count > 0) return;

        var legacyUser = await connection.ExecuteScalarAsync<string?>(
            "SELECT Value FROM AppSettings WHERE Key = 'AuthUsername'");
        var legacyHash = await connection.ExecuteScalarAsync<string?>(
            "SELECT Value FROM AppSettings WHERE Key = 'AuthPasswordHash'");
        var legacySalt = await connection.ExecuteScalarAsync<string?>(
            "SELECT Value FROM AppSettings WHERE Key = 'AuthPasswordSalt'");

        if (!string.IsNullOrWhiteSpace(legacyUser)
            && !string.IsNullOrWhiteSpace(legacyHash)
            && !string.IsNullOrWhiteSpace(legacySalt))
        {
            await connection.ExecuteAsync(
                """
                INSERT INTO AppUser (Username, FirstName, LastName, PasswordHash, PasswordSalt, CreatedAt)
                VALUES (@Username, @FirstName, @LastName, @PasswordHash, @PasswordSalt, @CreatedAt)
                """,
                new
                {
                    Username = legacyUser.Trim(),
                    FirstName = SeedFirstName,
                    LastName = SeedLastName,
                    PasswordHash = legacyHash,
                    PasswordSalt = legacySalt,
                    CreatedAt = DateTime.UtcNow.ToString("o"),
                });
            return;
        }

        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = HashPassword(SeedPassword, salt);
        await connection.ExecuteAsync(
            """
            INSERT INTO AppUser (Username, FirstName, LastName, PasswordHash, PasswordSalt, CreatedAt)
            VALUES (@Username, @FirstName, @LastName, @PasswordHash, @PasswordSalt, @CreatedAt)
            """,
            new
            {
                Username = SeedUsername,
                FirstName = SeedFirstName,
                LastName = SeedLastName,
                PasswordHash = Convert.ToBase64String(hash),
                PasswordSalt = Convert.ToBase64String(salt),
                CreatedAt = DateTime.UtcNow.ToString("o"),
            });
    }

    public async Task<bool> ValidateAsync(string username, string password)
    {
        var user = (username ?? string.Empty).Trim();
        if (user.Length == 0 || string.IsNullOrEmpty(password)) return false;

        using var connection = _factory.Create();
        var row = await connection.QuerySingleOrDefaultAsync<AppUserRecord>(
            UserSelect + " WHERE lower(Username) = lower(@Username)",
            new { Username = user });
        if (row is null) return false;

        var salt = Convert.FromBase64String(row.PasswordSalt);
        var expected = Convert.FromBase64String(row.PasswordHash);
        var actual = HashPassword(password, salt);
        return CryptographicOperations.FixedTimeEquals(expected, actual);
    }

    public async Task SignInAsync(HttpContext http, string username)
    {
        using var connection = _factory.Create();
        var row = await connection.QuerySingleOrDefaultAsync<AppUserRecord>(
            UserSelect + " WHERE lower(Username) = lower(@Username)",
            new { Username = username.Trim() });
        var name = (row?.Username ?? username).Trim();
        var display = row is null ? name : $"{row.FirstName} {row.LastName}".Trim();
        var claims = new List<Claim>
        {
            new(ClaimTypes.Name, name),
            new(ClaimTypes.NameIdentifier, name.ToLowerInvariant()),
            new(ClaimTypes.Role, row?.Role ?? "User"),
            new("uid", (row?.Id ?? 0).ToString()),
            new("display_name", display),
        };
        if (!string.IsNullOrWhiteSpace(row?.Email))
            claims.Add(new Claim(ClaimTypes.Email, row.Email.Trim()));
        var identity = new ClaimsIdentity(claims, CookieScheme);
        await http.SignInAsync(
            CookieScheme,
            new ClaimsPrincipal(identity),
            new AuthenticationProperties
            {
                IsPersistent = true,
                ExpiresUtc = DateTimeOffset.UtcNow.AddDays(30),
            });
    }

    public Task SignOutAsync(HttpContext http) => http.SignOutAsync(CookieScheme);

    public string? CurrentUsername(ClaimsPrincipal user)
    {
        var name = user.Identity?.Name;
        return string.IsNullOrWhiteSpace(name) ? null : name.Trim();
    }

    public async Task<AppUserDto?> GetByUsernameAsync(string username)
    {
        using var connection = _factory.Create();
        var row = await connection.QuerySingleOrDefaultAsync<AppUserRecord>(
            UserSelect + " WHERE lower(Username) = lower(@Username)",
            new { Username = username.Trim() });
        return row is null ? null : ToDto(row);
    }

    public async Task<IReadOnlyList<AppUserDto>> ListUsersAsync()
    {
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<AppUserRecord>(UserSelect + " ORDER BY Id");
        return rows.Select(ToDto).ToList();
    }

    public async Task<AppUserDto> CreateUserAsync(CreateUserRequest request)
    {
        var username = (request.Username ?? string.Empty).Trim();
        if (username.Length < 2) throw new ArgumentException("نام کاربری کوتاه است");
        var first = (request.FirstName ?? string.Empty).Trim();
        var last = (request.LastName ?? string.Empty).Trim();
        if (first.Length == 0) throw new ArgumentException("نام را وارد کن");
        if (last.Length == 0) throw new ArgumentException("نام خانوادگی را وارد کن");
        var email = NormalizeEmail(request.Email);
        var password = request.Password ?? string.Empty;
        if (password.Length < 4) throw new ArgumentException("رمز حداقل ۴ کاراکتر باشد");

        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = HashPassword(password, salt);
        var topic = NormalizeNtfyTopic(request.NtfyTopic);
        if (topic.Length == 0) topic = "taskos-" + Guid.NewGuid().ToString("N")[..8];

        using var connection = _factory.Create();
        try
        {
            var id = await connection.ExecuteScalarAsync<long>(
                """
                INSERT INTO AppUser (Username, FirstName, LastName, Email, NtfyTopic, Role, PasswordHash, PasswordSalt, CreatedAt)
                VALUES (@Username, @FirstName, @LastName, @Email, @NtfyTopic, @Role, @PasswordHash, @PasswordSalt, @CreatedAt);
                SELECT last_insert_rowid();
                """,
                new
                {
                    Username = username,
                    FirstName = first,
                    LastName = last,
                    Email = email,
                    NtfyTopic = topic,
                    Role = string.IsNullOrWhiteSpace(request.Role) ? "User" : request.Role.Trim(),
                    PasswordHash = Convert.ToBase64String(hash),
                    PasswordSalt = Convert.ToBase64String(salt),
                    CreatedAt = DateTime.UtcNow.ToString("o"),
                });
            var created = await connection.QuerySingleAsync<AppUserRecord>(UserSelect + " WHERE Id = @Id", new { Id = id });
            return ToDto(created);
        }
        catch (Exception ex) when (ex.Message.Contains("UNIQUE", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("نام کاربری، ایمیل یا موضوع ntfy تکراری است");
        }
    }

    public async Task<AppUserDto?> UpdateUserAsync(int id, UpdateUserRequest request)
    {
        using var connection = _factory.Create();
        var row = await connection.QuerySingleOrDefaultAsync<AppUserRecord>(UserSelect + " WHERE Id = @Id", new { Id = id });
        if (row is null) return null;

        var first = request.FirstName is null ? row.FirstName : request.FirstName.Trim();
        var last = request.LastName is null ? row.LastName : request.LastName.Trim();
        var email = request.Email is null ? row.Email : NormalizeEmail(request.Email);
        var role = request.Role is null ? row.Role : request.Role.Trim();
        var topic = request.NtfyTopic is null ? row.NtfyTopic : NormalizeNtfyTopic(request.NtfyTopic);

        string passwordHash = row.PasswordHash;
        string passwordSalt = row.PasswordSalt;
        if (!string.IsNullOrEmpty(request.Password))
        {
            if (request.Password.Length < 4) throw new ArgumentException("رمز حداقل ۴ کاراکتر باشد");
            var salt = RandomNumberGenerator.GetBytes(16);
            var hash = HashPassword(request.Password, salt);
            passwordHash = Convert.ToBase64String(hash);
            passwordSalt = Convert.ToBase64String(salt);
        }

        try
        {
            await connection.ExecuteAsync(
                """
                UPDATE AppUser
                SET FirstName = @FirstName, LastName = @LastName, Email = @Email, NtfyTopic = @NtfyTopic,
                    Role = @Role, PasswordHash = @PasswordHash, PasswordSalt = @PasswordSalt
                WHERE Id = @Id
                """,
                new
                {
                    Id = id,
                    FirstName = first,
                    LastName = last,
                    Email = email,
                    NtfyTopic = string.IsNullOrWhiteSpace(topic) ? null : topic,
                    Role = string.IsNullOrWhiteSpace(role) ? "User" : role,
                    PasswordHash = passwordHash,
                    PasswordSalt = passwordSalt,
                });
        }
        catch (Exception ex) when (ex.Message.Contains("UNIQUE", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("ایمیل یا موضوع ntfy تکراری است");
        }

        var updated = await connection.QuerySingleAsync<AppUserRecord>(UserSelect + " WHERE Id = @Id", new { Id = id });
        return ToDto(updated);
    }

    public async Task<bool> DeleteUserAsync(int id, string actingUsername)
    {
        using var connection = _factory.Create();
        var row = await connection.QuerySingleOrDefaultAsync<AppUserRecord>(UserSelect + " WHERE Id = @Id", new { Id = id });
        if (row is null) return false;
        if (string.Equals(row.Username, actingUsername, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("نمی‌توانی خودت را حذف کنی");
        await connection.ExecuteAsync("DELETE FROM AppUser WHERE Id = @Id", new { Id = id });
        return true;
    }

    public async Task ForgotPasswordAsync(string email)
    {
        var key = (email ?? string.Empty).Trim();
        if (key.Length == 0) throw new ArgumentException("ایمیل را وارد کن");
        if (!key.Contains('@', StringComparison.Ordinal))
            throw new ArgumentException("فقط یک ایمیل معتبر وارد کن");

        using var connection = _factory.Create();
        AppUserRecord? row = await connection.QuerySingleOrDefaultAsync<AppUserRecord>(
            UserSelect + " WHERE Email IS NOT NULL AND lower(Email) = lower(@Key)",
            new { Key = key });

        // Missing user = no-op success (no account enumeration).
        if (row is null) return;

        var topic = NormalizeNtfyTopic(row.NtfyTopic);
        if (topic.Length == 0)
            throw new InvalidOperationException("برای این کاربر موضوع ntfy تنظیم نشده. اول در تنظیمات یا مدیریت کاربران، موضوع ntfy اختصاصی را ست کن تا فقط گوشی‌های همان کاربر نوتیف بگیرند.");

        var temp = GenerateTempPassword();
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = HashPassword(temp, salt);
        await connection.ExecuteAsync(
            "UPDATE AppUser SET PasswordHash = @PasswordHash, PasswordSalt = @PasswordSalt, MustChangePassword = 1 WHERE Id = @Id",
            new
            {
                Id = row.Id,
                PasswordHash = Convert.ToBase64String(hash),
                PasswordSalt = Convert.ToBase64String(salt),
            });

        var n = await _push.SendToTopicAsync(
            topic,
            "بازیابی رمز TaskOS",
            $"کد موقت: {temp}\nبا این کد در صفحه بازیابی رمز وارد شو و رمز جدید بگذار.",
            "/forgot-password");
        if (n <= 0)
            throw new InvalidOperationException("ارسال رمز موقت به ntfy ناموفق بود. موضوع ntfy کاربر و Subscribe گوشی را چک کن.");
    }

    public async Task ResetPasswordWithTempAsync(string email, string tempPassword, string newPassword)
    {
        var key = (email ?? string.Empty).Trim();
        var temp = (tempPassword ?? string.Empty).Trim();
        var next = newPassword ?? string.Empty;
        if (key.Length == 0) throw new ArgumentException("ایمیل را وارد کن");
        if (temp.Length == 0) throw new ArgumentException("کد موقت را وارد کن");
        if (next.Length < 4) throw new ArgumentException("رمز جدید حداقل ۴ کاراکتر باشد");

        using var connection = _factory.Create();
        var row = await connection.QuerySingleOrDefaultAsync<AppUserRecord>(
            UserSelect + " WHERE Email IS NOT NULL AND lower(Email) = lower(@Key)",
            new { Key = key });
        if (row is null)
            throw new InvalidOperationException("کد یا ایمیل نامعتبر است");
        if (row.MustChangePassword == 0)
            throw new InvalidOperationException("درخواست بازیابی فعالی نیست. دوباره کد موقت بگیر.");

        if (!await ValidateAsync(row.Username, temp))
            throw new ArgumentException("کد موقت اشتباه است");

        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = HashPassword(next, salt);
        await connection.ExecuteAsync(
            "UPDATE AppUser SET PasswordHash = @PasswordHash, PasswordSalt = @PasswordSalt, MustChangePassword = 0 WHERE Id = @Id",
            new
            {
                Id = row.Id,
                PasswordHash = Convert.ToBase64String(hash),
                PasswordSalt = Convert.ToBase64String(salt),
            });
    }

    public async Task ChangePasswordAsync(string username, string? currentPassword, string newPassword)
    {
        var user = (username ?? string.Empty).Trim();
        var next = newPassword ?? string.Empty;
        if (user.Length == 0) throw new ArgumentException("کاربر نامعتبر");
        if (next.Length < 4) throw new ArgumentException("رمز جدید حداقل ۴ کاراکتر باشد");

        using var connection = _factory.Create();
        var row = await connection.QuerySingleOrDefaultAsync<AppUserRecord>(
            UserSelect + " WHERE lower(Username) = lower(@Username)",
            new { Username = user });
        if (row is null) throw new InvalidOperationException("کاربر پیدا نشد");

        if (row.MustChangePassword == 0)
        {
            if (string.IsNullOrEmpty(currentPassword) || !await ValidateAsync(user, currentPassword))
                throw new ArgumentException("رمز فعلی اشتباه است");
        }

        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = HashPassword(next, salt);
        await connection.ExecuteAsync(
            "UPDATE AppUser SET PasswordHash = @PasswordHash, PasswordSalt = @PasswordSalt, MustChangePassword = 0 WHERE Id = @Id",
            new
            {
                Id = row.Id,
                PasswordHash = Convert.ToBase64String(hash),
                PasswordSalt = Convert.ToBase64String(salt),
            });
    }

    public async Task<string> UpdateMyNtfyTopicAsync(string username, string? topic)
    {
        var name = (username ?? string.Empty).Trim();
        if (name.Length == 0) throw new ArgumentException("کاربر نامعتبر");
        var normalized = NormalizeNtfyTopic(topic);
        if (normalized.Length == 0)
            throw new ArgumentException("موضوع ntfy را وارد کن");

        using var connection = _factory.Create();
        try
        {
            var n = await connection.ExecuteAsync(
                "UPDATE AppUser SET NtfyTopic = @NtfyTopic WHERE lower(Username) = lower(@Username)",
                new { Username = name, NtfyTopic = normalized });
            if (n == 0) throw new InvalidOperationException("کاربر پیدا نشد");
            return normalized;
        }
        catch (Exception ex) when (ex.Message.Contains("UNIQUE", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("این موضوع ntfy قبلاً برای کاربر دیگری ثبت شده");
        }
    }

    public async Task<AppUserDto> UpsertGoogleUserAsync(string googleSubject, string email, string? firstName, string? lastName)
    {
        var subject = (googleSubject ?? string.Empty).Trim();
        var mail = NormalizeEmail(email) ?? throw new ArgumentException("ایمیل گوگل نامعتبر است");
        if (subject.Length == 0) throw new ArgumentException("شناسه گوگل خالی است");

        using var connection = _factory.Create();
        var bySubject = await connection.QuerySingleOrDefaultAsync<AppUserRecord>(
            UserSelect + " WHERE GoogleSubject = @Subject", new { Subject = subject });
        if (bySubject is not null) return ToDto(bySubject);

        var byEmail = await connection.QuerySingleOrDefaultAsync<AppUserRecord>(
            UserSelect + " WHERE Email IS NOT NULL AND lower(Email) = lower(@Email)",
            new { Email = mail });
        if (byEmail is not null)
        {
            await connection.ExecuteAsync(
                "UPDATE AppUser SET GoogleSubject = @Subject WHERE Id = @Id",
                new { Subject = subject, Id = byEmail.Id });
            byEmail.GoogleSubject = subject;
            return ToDto(byEmail);
        }

        var baseUser = mail.Split('@')[0];
        var username = baseUser;
        var i = 0;
        while (await connection.ExecuteScalarAsync<int>(
                   "SELECT COUNT(*) FROM AppUser WHERE lower(Username) = lower(@Username)",
                   new { Username = username }) > 0)
        {
            i++;
            username = baseUser + i;
        }

        var fn = string.IsNullOrWhiteSpace(firstName) ? username : firstName.Trim();
        var ln = string.IsNullOrWhiteSpace(lastName) ? "Google" : lastName.Trim();
        var salt = RandomNumberGenerator.GetBytes(16);
        var temp = GenerateTempPassword();
        var hash = HashPassword(temp, salt);
        var topic = "taskos-" + Guid.NewGuid().ToString("N")[..8];

        var id = await connection.ExecuteScalarAsync<long>(
            """
            INSERT INTO AppUser (Username, FirstName, LastName, Email, GoogleSubject, NtfyTopic, Role, PasswordHash, PasswordSalt, CreatedAt)
            VALUES (@Username, @FirstName, @LastName, @Email, @GoogleSubject, @NtfyTopic, @Role, @PasswordHash, @PasswordSalt, @CreatedAt);
            SELECT last_insert_rowid();
            """,
            new
            {
                Username = username,
                FirstName = fn,
                LastName = ln,
                Email = mail,
                GoogleSubject = subject,
                NtfyTopic = topic,
                Role = "User",
                PasswordHash = Convert.ToBase64String(hash),
                PasswordSalt = Convert.ToBase64String(salt),
                CreatedAt = DateTime.UtcNow.ToString("o"),
            });

        var created = await connection.QuerySingleAsync<AppUserRecord>(UserSelect + " WHERE Id = @Id", new { Id = id });
        return ToDto(created);
    }

    public async Task<bool> IsAdminAsync(string? username)
    {
        if (string.IsNullOrWhiteSpace(username)) return false;
        var me = await GetByUsernameAsync(username);
        return string.Equals(me?.Role, "Admin", StringComparison.OrdinalIgnoreCase)
               || string.Equals(username, SeedUsername, StringComparison.OrdinalIgnoreCase);
    }

    private const string UserSelect = """
        SELECT Id, Username, FirstName, LastName, Email, GoogleSubject, NtfyTopic, Role, MustChangePassword, PasswordHash, PasswordSalt, CreatedAt
        FROM AppUser
        """;

    private static byte[] HashPassword(string password, byte[] salt)
    {
        return Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password),
            salt,
            100_000,
            HashAlgorithmName.SHA256,
            32);
    }

    private static string GenerateTempPassword()
    {
        Span<byte> bytes = stackalloc byte[4];
        RandomNumberGenerator.Fill(bytes);
        var n = BitConverter.ToUInt32(bytes) % 1_000_000u;
        return n.ToString("D6");
    }

    private static string? NormalizeEmail(string? email)
    {
        var value = (email ?? string.Empty).Trim();
        if (value.Length == 0) return null;
        if (!EmailRegex.IsMatch(value)) throw new ArgumentException("ایمیل نامعتبر است");
        return value;
    }

    private static string NormalizeNtfyTopic(string? topic)
    {
        var value = (topic ?? string.Empty).Trim().ToLowerInvariant();
        if (value.Length == 0) return string.Empty;
        value = Regex.Replace(value, @"[^a-z0-9_-]+", "-");
        return value.Trim('-');
    }

    private static AppUserDto ToDto(AppUserRecord row) => new()
    {
        Id = row.Id,
        Username = row.Username,
        FirstName = row.FirstName,
        LastName = row.LastName,
        Email = row.Email,
        NtfyTopic = row.NtfyTopic,
        Role = row.Role ?? "User",
        MustChangePassword = row.MustChangePassword != 0,
        HasGoogle = !string.IsNullOrWhiteSpace(row.GoogleSubject),
        CreatedAt = row.CreatedAt,
    };
}

/// <summary>
/// Auto-auth for local Chrome extension / loopback without cookies.
/// Never auto-auth when the request came through a reverse proxy (nginx),
/// otherwise every browser user would inherit the loopback identity.
/// </summary>
public sealed class LoopbackLocalAuthMiddleware
{
    private readonly RequestDelegate _next;

    public LoopbackLocalAuthMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.User?.Identity?.IsAuthenticated != true
            && (IsExtensionClient(context)
                || (!IsProxied(context)
                    && IsLoopback(context.Connection.RemoteIpAddress)
                    && IsLocalTool(context))))
        {
            var identity = new ClaimsIdentity(
                new[]
                {
                    new Claim(ClaimTypes.Name, "reza"),
                    new Claim(ClaimTypes.NameIdentifier, "reza"),
                    new Claim("auth_mode", "loopback"),
                },
                "Loopback");
            context.User = new ClaimsPrincipal(identity);
        }

        await _next(context);
    }

    private static bool IsExtensionClient(HttpContext context)
    {
        if (context.Request.Headers.TryGetValue("X-TaskOS-Extension", out var marker)
            && !string.IsNullOrWhiteSpace(marker))
        {
            return true;
        }

        var origin = context.Request.Headers.Origin.ToString();
        return origin.StartsWith("chrome-extension://", StringComparison.OrdinalIgnoreCase)
            || origin.StartsWith("moz-extension://", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsProxied(HttpContext context) =>
        context.Request.Headers.ContainsKey("X-Forwarded-For")
        || context.Request.Headers.ContainsKey("X-Real-IP")
        || context.Request.Headers.ContainsKey("X-Forwarded-Proto");

    private static bool IsLoopback(IPAddress? ip) =>
        ip is not null && (IPAddress.IsLoopback(ip) || ip.Equals(IPAddress.IPv6Loopback));

    private static bool IsLocalTool(HttpContext context)
    {
        var origin = context.Request.Headers.Origin.ToString();
        if (string.IsNullOrWhiteSpace(origin)) return true;
        if (origin.StartsWith("chrome-extension://", StringComparison.OrdinalIgnoreCase)) return true;
        if (origin.StartsWith("moz-extension://", StringComparison.OrdinalIgnoreCase)) return true;
        return false;
    }
}