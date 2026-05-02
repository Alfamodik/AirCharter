$ErrorActionPreference = "Stop"

$root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$artifacts = Join-Path $root "artifacts"
$pidFile = Join-Path $artifacts "api.pid"

$stopped = $false

if (Test-Path -LiteralPath $pidFile) {
    $rawPid = Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
    $apiPid = 0

    if ([int]::TryParse($rawPid, [ref]$apiPid)) {
        $process = Get-Process -Id $apiPid -ErrorAction SilentlyContinue

        if ($process) {
            Write-Host "Stopping API process: $apiPid"
            Stop-Process -Id $apiPid -Force
            $stopped = $true
        }
    }

    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}

Get-Process -Name "AirCharter.API" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Stopping old AirCharter.API.exe process: $($_.Id)"
    Stop-Process -Id $_.Id -Force
    $script:stopped = $true
}

if (-not $stopped) {
    Write-Host "API process was not running."
}
