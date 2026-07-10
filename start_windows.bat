@echo off
echo =========================================
echo    Starting RO Digital Twin
echo =========================================
echo.
echo Starting all servers... Please wait.

cd %~dp0

:: Start ML Server in a new window
start "ML Server" cmd /k "call venv\Scripts\activate && python ml_server.py"

:: Start Backend Server in a new window
start "Backend Server" cmd /k "node server.js"

:: Start Frontend Server in a new window
start "Frontend Server" cmd /k "cd frontend && npm run dev"

echo.
echo Servers are starting in separate windows...
echo Opening browser in a few seconds!

:: Wait for 5 seconds to give servers time to start
timeout /t 5 /nobreak >nul

:: Open the app in the default web browser
start http://localhost:5173

exit
