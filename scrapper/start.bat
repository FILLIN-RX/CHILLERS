@echo off
cd /d %~dp0
echo [Chiller Scrapper] Demarrage...
echo.

REM Verify .env exists
if not exist .env (
    echo ERROR: .env file not found!
    echo Copiez .env.example en .env et configurez MONGO_URI
    pause
    exit /b 1
)

REM Install dependencies if needed
if not exist node_modules (
    echo Installation des dependances...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed
        pause
        exit /b 1
    )
)

REM Install Playwright browser if needed
echo Verification de Playwright...
call npx playwright install chromium 2>nul

REM Build TypeScript
echo Compilation TypeScript...
call npm run build
if errorlevel 1 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

REM Start the service
echo.
echo [Chiller Scrapper] Demarrage du service sur le port %PORT%
echo [Chiller Scrapper] Pour arreter: fermez cette fenetre ou Ctrl+C
echo.
node dist/index.js
pause
