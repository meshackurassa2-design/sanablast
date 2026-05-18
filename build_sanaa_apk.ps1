$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = "Stop"

$sdkRoot = "C:\Users\Joshan\.gemini\antigravity\scratch\android_sdk"
$env:ANDROID_HOME = $sdkRoot
$env:JAVA_HOME = "C:\Users\Joshan\.gemini\antigravity\scratch\jdk21\jdk21.0.11_10"

Write-Host "ANDROID_HOME = $env:ANDROID_HOME"
Write-Host "JAVA_HOME = $env:JAVA_HOME"

Set-Location "C:\Users\Joshan\.gemini\antigravity\scratch\sanaa-blast\android"

# Kill any leftover Gradle daemons to avoid remote build locks
.\gradlew --stop 2>&1 | Out-Null

Write-Host "Executing Gradle Clean and assembleDebug..."
.\gradlew clean assembleDebug --no-daemon

if ($LASTEXITCODE -eq 0) {
    Copy-Item "app\build\outputs\apk\debug\app-debug.apk" "C:\Users\Joshan\Desktop\SanaaBlast.apk" -Force
    Write-Host ""
    Write-Host "========================================"
    Write-Host "SUCCESS! SanaaBlast.apk is on your Desktop =>"
    Write-Host "C:\Users\Joshan\Desktop\SanaaBlast.apk"
    Write-Host "========================================"
} else {
    Write-Host "Gradle build failed."
}
