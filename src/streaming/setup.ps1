# Setup script for CryoTrace Big Data Pipeline (Local Dev)
# Installs Python dependencies and sets up the local environment

Write-Host "Setting up CryoTrace Streaming Pipeline..." -ForegroundColor Cyan

# 1. Install pip requirements
Write-Host "`n[1] Installing PySpark and Confluent Kafka..." -ForegroundColor Yellow
pip install pyspark==3.5.1 confluent-kafka==2.3.0

# 2. Check for Java (Required by PySpark)
Write-Host "`n[2] Checking for Java (Required for PySpark)..." -ForegroundColor Yellow
$java_version = java -version 2>&1
if ($java_version -match "version") {
    Write-Host "✅ Java is installed." -ForegroundColor Green
} else {
    Write-Host "❌ Java is not installed or not in PATH. PySpark requires Java 8 or 11." -ForegroundColor Red
    Write-Host "Please download and install OpenJDK 11: https://adoptium.net/" -ForegroundColor Yellow
}

# 3. Create Data Directories
Write-Host "`n[3] Creating Data Directories..." -ForegroundColor Yellow
$dirs = @(
    "..\data\sensor_logs",
    "..\data\checkpoints\sensor",
    "..\data\checkpoints\anomaly",
    "..\data\analytics\hourly_summary",
    "..\data\analytics\daily_excursions"
)

foreach ($dir in $dirs) {
    if (-not (Test-Path -Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        Write-Host "Created $dir"
    }
}
Write-Host "✅ Data directories ready." -ForegroundColor Green

Write-Host "`nSetup complete! Note: You do not *need* a local Kafka broker installed to run the pipeline in fallback mode." -ForegroundColor Cyan
Write-Host "To start the streaming job, run: python .\run_jobs.py" -ForegroundColor Cyan
