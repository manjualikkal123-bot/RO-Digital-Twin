@echo off
echo =========================================
echo    Starting RO Digital Twin (Zero-Downtime Mode)
echo =========================================
echo.
echo Launching robust Daemon Manager (PM2)...

cd %~dp0
call start_daemons.bat

exit
