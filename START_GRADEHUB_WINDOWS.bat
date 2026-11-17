@echo off
chcp 65001 >nul
cd /d "%~dp0"
where npm >nul 2>&1
if errorlevel 1 (
    echo Node.js / npm is not installed. Please install Node.js 22 LTS first.
    pause
    exit /b 1
)
if not exist "node_modules\" (
    echo Installing dependencies for first run...
    call npm install
    if errorlevel 1 (
        echo npm install failed. Please check your internet connection.
        pause
        exit /b 1
    )
)
echo Starting Gradeculator...
echo Open the address shown below (usually http://127.0.0.1:5173/).
call npm run dev
pause
