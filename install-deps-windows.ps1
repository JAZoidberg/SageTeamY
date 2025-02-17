Write-Host "🟣 Installing dependencies for Windows..."

# Ensure Chocolatey is installed
if (-Not (Test-Path "$env:ProgramData\chocolatey")) {
    Write-Host "📦 Installing Chocolatey..."
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
}

# Refresh environment variables
$env:Path += ";C:\ProgramData\chocolatey\bin"

# Install build tools via Chocolatey
choco install -y python3 make mingw git cmake

# Install vcpkg for managing dependencies
if (-Not (Test-Path "C:\vcpkg")) {
    Write-Host "📦 Cloning vcpkg..."
    git clone https://github.com/microsoft/vcpkg.git C:\vcpkg
    cd C:\vcpkg
    .\bootstrap-vcpkg.bat
}

# Add vcpkg to PATH
$env:Path += ";C:\vcpkg"

# Install necessary libraries using vcpkg
Write-Host "📦 Installing Cairo, Pango, JPEG, and GIF dependencies..."
C:\vcpkg\vcpkg install cairo:x64-windows pango:x64-windows libjpeg-turbo:x64-windows giflib:x64-windows

Write-Host "✅ All dependencies installed successfully!"
