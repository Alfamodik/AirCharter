$NoRestore = $args -contains "-NoRestore"

$ErrorActionPreference = "Stop"

$root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$project = Join-Path $root "AirCharter.API\AirCharter.API\AirCharter.API.csproj"

$candidatePaths = @(
    $env:NUGET_PACKAGES,
    (Join-Path $env:USERPROFILE ".nuget\packages"),
    "C:\Users\Alfamod\.nuget\packages"
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

if ($candidatePaths.Count -gt 0) {
    $env:NUGET_PACKAGES = $candidatePaths[0]
    Write-Host "NuGet packages: $env:NUGET_PACKAGES"
}

& (Join-Path $PSScriptRoot "stop-api.ps1")

if (-not $NoRestore) {
    Write-Host "Restoring API packages from local cache..."
    & dotnet restore $project --ignore-failed-sources

    if ($LASTEXITCODE -ne 0) {
        Write-Host "Restore failed. Check NuGet packages or network/certificate settings."
        exit $LASTEXITCODE
    }
}

Write-Host "Building API..."
& dotnet build $project --no-restore

exit $LASTEXITCODE
