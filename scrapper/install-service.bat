@echo off
REM Installation du Chiller Scraper comme service Windows via PM2
REM Execute en Administrateur

cd /d %~dp0

echo [Chiller Scrapper] Installation du service...
echo.

REM Check if PM2 is installed
where pm2 >nul 2>nul
if %errorlevel% neq 0 (
    echo PM2 n'est pas installe. Installation en cours...
    call npm install -g pm2
)

REM Install dependencies
if not exist node_modules (
    call npm install
)

REM Build
call npm run build

REM Start with PM2
pm2 start dist/index.js --name chiller-scrapper

REM Save PM2 process list
pm2 save

REM Generate startup script
echo.
echo Configuration du demarrage automatique...
pm2 startup
echo.
echo [Chiller Scrapper] Installe avec succes!
echo [Chiller Scrapper] Le service demarrera automatiquement au demarrage de Windows.
echo.
echo Commandes utiles:
echo   pm2 status              - Voir l'etat
echo   pm2 logs chiller-scrapper - Voir les logs
echo   pm2 stop chiller-scrapper - Arreter
echo   pm2 restart chiller-scrapper - Redemarrer
echo.
pause
