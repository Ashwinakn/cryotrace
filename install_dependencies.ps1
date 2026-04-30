# Self-elevate the script if required
if (-Not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Elevating privileges... Please click 'Yes' on the UAC prompt." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit -ExecutionPolicy Bypass -NoProfile -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

Write-Host "Installing Docker Desktop via winget..." -ForegroundColor Cyan
winget install --id Docker.DockerDesktop -e --accept-package-agreements --accept-source-agreements

Write-Host "Installing Go via winget..." -ForegroundColor Cyan
winget install --id GoLang.Go -e --accept-package-agreements --accept-source-agreements

Write-Host "Enabling WSL2 features..." -ForegroundColor Cyan
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Yellow
Write-Host "Installation commands executed!" -ForegroundColor Green
Write-Host "Please RESTART YOUR COMPUTER to apply WSL2 and Docker changes." -ForegroundColor Red
Write-Host "After restarting, run Docker Desktop to complete its initialization." -ForegroundColor Yellow
Write-Host "=======================================================" -ForegroundColor Yellow
