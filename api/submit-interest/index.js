// Directory: /api
// Files for an Azure Functions (Isolated) project that works with Azure Static Web Apps

// -----------------------------
// File: SubmitInterest.csproj
// -----------------------------
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <OutputType>Exe</OutputType>
    <AzureFunctionsVersion>v4</AzureFunctionsVersion>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.Azure.Functions.Worker" Version="1.21.0" />
    <PackageReference Include="Microsoft.Azure.Functions.Worker.Extensions.Http" Version="3.1.0" />
    <PackageReference Include="Azure.Data.Tables" Version="12.9.1" />
    <PackageReference Include="Microsoft.Extensions.Configuration.UserSecrets" Version="8.0.0" />
    <PackageReference Include="Microsoft.Extensions.Logging.ApplicationInsights" Version="2.22.0" />
  </ItemGroup>
</Project>

// -----------------------------
// File: Program.cs
// -----------------------------
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults()
    .ConfigureServices(services => { })
    .Build();

host.Run();

// -----------------------------
// File: Models/SignupEntity.cs
// -----------------------------
using Azure;
using Azure.Data.Tables;

namespace SubmitInterest.Models;

public class SignupEntity : ITableEntity
{
    public string PartitionKey { get; set; } = "signup"; // or region
    public string RowKey { get; set; } = Guid.NewGuid().ToString("N");

    public DateTimeOffset? Timestamp { get; set; }
    public ETag ETag { get; set; }

    // Captured fields
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Role { get; set; }
    public string? Location { get; set; }
    public string? Message { get; set; }
    public bool Consent { get; set; }

    public string? Source { get; set; }
    public string? UserAgent { get; set; }
    public DateTime SubmittedAtUtc { get; set; }
}

// -----------------------------
// File: Functions/SubmitInterestFunction.cs
// -----------------------------
using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Azure;
using Azure.Data.Tables;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using SubmitInterest.Models;

namespace SubmitInterest.Functions;

public class SubmitInterestFunction
{
    private readonly ILogger _logger;
    private readonly TableClient _table;

    public SubmitInterestFunction(ILoggerFactory loggerFactory)
    {
        _logger = loggerFactory.CreateLogger<SubmitInterestFunction>();
        var conn = Environment.GetEnvironmentVariable("StorageConnection");
        if (string.IsNullOrWhiteSpace(conn))
            throw new InvalidOperationException("Missing StorageConnection setting.");
        var service = new TableServiceClient(conn);
        _table = service.GetTableClient("WattlySignups");
        _table.CreateIfNotExists();
    }

    [Function("submit-interest")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "submit-interest")] HttpRequestData req)
    {
        try
        {
            var body = await JsonSerializer.DeserializeAsync<SignupPayload>(req.Body, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            // Basic validation
            var errors = new List<string>();
            if (body is null) errors.Add("Invalid JSON");
            if (string.IsNullOrWhiteSpace(body?.Email)) errors.Add("Email is required");
            if (string.IsNullOrWhiteSpace(body?.FirstName)) errors.Add("First name is required");
            if (string.IsNullOrWhiteSpace(body?.LastName)) errors.Add("Last name is required");
            if (body?.Consent != true) errors.Add("Consent is required");

            if (errors.Count > 0)
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { ok = false, errors });
                return bad;
            }

            var entity = new SignupEntity
            {
                PartitionKey = (body!.Location ?? "signup").Trim().ToLowerInvariant(),
                FirstName = body!.FirstName,
                LastName = body!.LastName,
                Email = body!.Email,
                Phone = body!.Phone,
                Role = body!.Role,
                Location = body!.Location,
                Message = body!.Message,
                Consent = body!.Consent,
                Source = body!.Source,
                UserAgent = body!.UserAgent,
                SubmittedAtUtc = DateTime.UtcNow
            };

            await _table.AddEntityAsync(entity);

            var res = req.CreateResponse(HttpStatusCode.OK);
            await res.WriteAsJsonAsync(new { ok = true });
            return res;
        }
        catch (RequestFailedException rfe)
        {
            _logger.LogError(rfe, "Table Storage error");
            var res = req.CreateResponse(HttpStatusCode.InternalServerError);
            await res.WriteAsJsonAsync(new { ok = false, error = "Storage error" });
            return res;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled error");
            var res = req.CreateResponse(HttpStatusCode.InternalServerError);
            await res.WriteAsJsonAsync(new { ok = false, error = "Server error" });
            return res;
        }
    }

    private sealed class SignupPayload
    {
        [JsonPropertyName("firstName")] public string? FirstName { get; set; }
        [JsonPropertyName("lastName")]  public string? LastName  { get; set; }
        [JsonPropertyName("email")]     public string? Email     { get; set; }
        [JsonPropertyName("phone")]     public string? Phone     { get; set; }
        [JsonPropertyName("role")]      public string? Role      { get; set; }
        [JsonPropertyName("location")]  public string? Location  { get; set; }
        [JsonPropertyName("message")]   public string? Message   { get; set; }
        [JsonPropertyName("consent")]   public bool   Consent    { get; set; }
        [JsonPropertyName("source")]    public string? Source    { get; set; }
        [JsonPropertyName("userAgent")] public string? UserAgent { get; set; }
    }
}
