$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = "Stop"

$jdkUrl = "https://corretto.aws/downloads/latest/amazon-corretto-21-x64-windows-jdk.zip"
$jdkZipFile = "C:\Users\Joshan\.gemini\antigravity\scratch\jdk21.zip"
$jdkExtractPath = "C:\Users\Joshan\.gemini\antigravity\scratch\jdk21"

if (-not (Test-Path "$jdkExtractPath\bin\java.exe" -ErrorAction SilentlyContinue) -and -not (Test-Path "$jdkExtractPath\*\bin\java.exe" -ErrorAction SilentlyContinue)) {
    if (-not (Test-Path $jdkExtractPath)) {
        New-Item -ItemType Directory -Force -Path $jdkExtractPath | Out-Null
    }
    
    Write-Host "Downloading portable JDK 21 (this may take a minute depending on network)..."
    Invoke-WebRequest -Uri $jdkUrl -OutFile $jdkZipFile

    Write-Host "Extracting JDK 21..."
    Expand-Archive -Path $jdkZipFile -DestinationPath $jdkExtractPath -Force
    
    Remove-Item -Path $jdkZipFile -Force
    Write-Host "JDK 21 downloaded and extracted successfully."
} else {
    Write-Host "JDK 21 already exists locally."
}

# Find java.exe path
$javaExe = Get-ChildItem -Path $jdkExtractPath -Recurse -Filter "java.exe" | Select-Object -First 1
Write-Host "Found java.exe: $($javaExe.FullName)"
