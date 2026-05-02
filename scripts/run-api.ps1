param(
    [switch]$NoBuild,
    [switch]$NoRestore
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$project = Join-Path $root "AirCharter.API\AirCharter.API\AirCharter.API.csproj"
$artifacts = Join-Path $root "artifacts"
$pidFile = Join-Path $artifacts "api.pid"
$outLog = Join-Path $artifacts "api.out.log"
$errLog = Join-Path $artifacts "api.err.log"

New-Item -ItemType Directory -Force -Path $artifacts | Out-Null

function Use-LocalNuGetCache {
    $candidatePaths = @(
        $env:NUGET_PACKAGES,
        (Join-Path $env:USERPROFILE ".nuget\packages"),
        "C:\Users\Alfamod\.nuget\packages"
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

    if ($candidatePaths.Count -gt 0) {
        $env:NUGET_PACKAGES = $candidatePaths[0]
        Write-Host "NuGet packages: $env:NUGET_PACKAGES"
    }
}

function Restore-ApiPackages {
    if ($NoRestore) {
        return
    }

    Write-Host "Restoring API packages from local cache..."
    & dotnet restore $project --ignore-failed-sources

    if ($LASTEXITCODE -ne 0) {
        Write-Host "Restore failed. Check NuGet packages or network/certificate settings."
        exit $LASTEXITCODE
    }
}

function Stop-PreviousApi {
    if (Test-Path -LiteralPath $pidFile) {
        $rawPid = Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
        $previousPid = 0

        if ([int]::TryParse($rawPid, [ref]$previousPid)) {
            $process = Get-Process -Id $previousPid -ErrorAction SilentlyContinue

            if ($process) {
                Write-Host "Stopping previous API process: $previousPid"
                Stop-Process -Id $previousPid -Force
            }
        }

        Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    }

    Get-Process -Name "AirCharter.API" -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "Stopping old AirCharter.API.exe process: $($_.Id)"
        Stop-Process -Id $_.Id -Force
    }
}

function Assert-HttpsDevCertificate {
    & dotnet dev-certs https --check *> $null

    if ($LASTEXITCODE -ne 0) {
        Write-Host "HTTPS developer certificate was not found or is out of date."
        Write-Host "Run this once, then start the API again:"
        Write-Host "  dotnet dev-certs https --trust"
        exit 1
    }
}

Stop-PreviousApi
Assert-HttpsDevCertificate
Use-LocalNuGetCache

if (-not $NoBuild) {
    Restore-ApiPackages

    Write-Host "Building API..."
    & dotnet build $project --no-restore

    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

Remove-Item -LiteralPath $outLog -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $errLog -Force -ErrorAction SilentlyContinue

$dotnetArgs = @(
    "run",
    "--project",
    $project,
    "--no-build",
    "--launch-profile",
    "https"
)

Write-Host "Starting API..."
$apiProcess = Start-Process `
    -FilePath "dotnet" `
    -ArgumentList $dotnetArgs `
    -WorkingDirectory $root `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -WindowStyle Hidden `
    -PassThru

$apiProcess.Id | Set-Content -LiteralPath $pidFile
Start-Sleep -Seconds 3
$apiProcess.Refresh()

if ($apiProcess.HasExited) {
    Write-Host "API stopped during startup. Exit code: $($apiProcess.ExitCode)"
    Write-Host "Stdout log: $outLog"
    Write-Host "Stderr log: $errLog"

    if (Test-Path -LiteralPath $errLog) {
        Get-Content -LiteralPath $errLog -Tail 40
    }

    exit $apiProcess.ExitCode
}

Write-Host "API started."
Write-Host "Swagger: https://localhost:7219/swagger"
Write-Host "Logs:"
Write-Host "  $outLog"
Write-Host "  $errLog"
