@echo off
REM Kidgo PWA - Deployment Launcher
REM This batch file opens PowerShell and runs the deployment script

title Kidgo PWA - Deployment
echo.
echo ========================================
echo   Kidgo PWA - Deployment Script
echo ========================================
echo.
echo Starting deployment...
echo.

REM Change to the script directory and run PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -Command "& '%~dp0deploy.ps1'"

REM Keep the window open so you can see the output
pause
