@echo off
echo =======================================================
echo     Starting RO Digital Twin Persistent Services...
echo =======================================================
echo.
echo Stopping any running node/python instances on these ports to avoid conflicts...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM python.exe >nul 2>&1

echo.
echo Starting PM2 Daemon Manager...
call npx pm2 start ecosystem.config.js
call npx pm2 save
call npx pm2 startup

echo.
echo =======================================================
echo All services are now running in the background!
echo - They will automatically restart if they crash.
echo - You can view their status anytime by running: npx pm2 status
echo - You can view logs by running: npx pm2 logs
echo - The frontend is available at: http://localhost:5173
echo =======================================================
pause
