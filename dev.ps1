# Drivenest fejlesztői indító.
#   .\dev.ps1 start
#   .\dev.ps1 stop

param(
    [Parameter(Position = 0)]
    [string]$Command
)

$ErrorActionPreference = 'Stop'

$Root = $PSScriptRoot
$ApiDirectory = Join-Path $Root 'drivenest.api\Drivenest.Api'
$FrontendDirectory = Join-Path $Root 'drivenest.frontend'
$StateDirectory = Join-Path $Root '.dev'
$StateFile = Join-Path $StateDirectory 'processes.json'

function Get-SavedProcesses {
    if (-not (Test-Path $StateFile)) {
        return $null
    }

    return Get-Content -Path $StateFile -Raw | ConvertFrom-Json
}

function Test-ProcessAlive {
    param([int]$ProcessId)

    if ($ProcessId -le 0) {
        return $false
    }

    return $null -ne (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)
}

function Stop-ProcessTree {
    param([int]$ProcessId)

    if (-not (Test-ProcessAlive -ProcessId $ProcessId)) {
        return
    }

    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & taskkill.exe /PID $ProcessId /T /F *> $null
    $ErrorActionPreference = $previousPreference
}

function Start-DevWindow {
    param(
        [string]$WorkingDirectory,
        [string]$Command
    )

    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = 'cmd.exe'
    $startInfo.Arguments = "/k $Command"
    $startInfo.WorkingDirectory = $WorkingDirectory
    $startInfo.UseShellExecute = $true

    return [System.Diagnostics.Process]::Start($startInfo)
}

function Start-Drivenest {
    $saved = Get-SavedProcesses
    if ($null -ne $saved) {
        $backendAlive = Test-ProcessAlive -ProcessId ([int]$saved.backend)
        $frontendAlive = Test-ProcessAlive -ProcessId ([int]$saved.frontend)
        if ($backendAlive -or $frontendAlive) {
            Write-Host 'A Drivenest már fut. Leállítás: .\dev.ps1 stop'
            exit 1
        }

        Remove-Item -Path $StateFile -Force
    }

    if (-not (Test-Path $ApiDirectory)) {
        Write-Host "Nem találom az API projektet: $ApiDirectory"
        exit 1
    }

    if (-not (Test-Path $FrontendDirectory)) {
        Write-Host "Nem találom a frontend projektet: $FrontendDirectory"
        exit 1
    }

    New-Item -ItemType Directory -Path $StateDirectory -Force | Out-Null

    $backendCommand = 'echo Drivenest API: http://localhost:5066/swagger && set ASPNETCORE_ENVIRONMENT=Development&& dotnet run --urls http://localhost:5066'
    $frontendCommand = 'echo Drivenest frontend: http://localhost:4200 && npm start'

    $backend = Start-DevWindow -WorkingDirectory $ApiDirectory -Command $backendCommand
    $frontend = Start-DevWindow -WorkingDirectory $FrontendDirectory -Command $frontendCommand

    @{
        backend = $backend.Id
        frontend = $frontend.Id
    } | ConvertTo-Json | Set-Content -Path $StateFile -Encoding utf8

    Write-Host 'Elindult a backend és a frontend, külön ablakban.'
    Write-Host '  API:      http://localhost:5066/swagger'
    Write-Host '  Frontend: http://localhost:4200'
    Write-Host 'Leállítás: .\dev.ps1 stop'
}

function Stop-Drivenest {
    $saved = Get-SavedProcesses
    if ($null -eq $saved) {
        Write-Host 'Nincs futó Drivenest, amit ez a szkript indított.'
        exit 0
    }

    Stop-ProcessTree -ProcessId ([int]$saved.backend)
    Stop-ProcessTree -ProcessId ([int]$saved.frontend)

    if (Test-Path $StateFile) {
        Remove-Item -Path $StateFile -Force
    }

    Write-Host 'A backend és a frontend leállt.'
}

switch ($Command) {
    'start' { Start-Drivenest }
    'stop' { Stop-Drivenest }
    default {
        Write-Host 'Használat:'
        Write-Host '  .\dev.ps1 start'
        Write-Host '  .\dev.ps1 stop'
        exit 1
    }
}
