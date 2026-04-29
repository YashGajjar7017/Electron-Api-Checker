@echo off
REM API Checker - Quick Setup Script for Windows
REM This script sets up and runs the API Checker application

echo.
echo ============================================================
echo        API Checker - Application Setup (Windows)
echo ============================================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [X] Node.js is not installed. Please install Node.js first.
    echo     Visit: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i

echo [OK] Node.js version: %NODE_VERSION%
echo [OK] npm version: %NPM_VERSION%
echo.

REM Install dependencies
echo Installing dependencies...
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo [X] Failed to install dependencies
    pause
    exit /b 1
)

echo [OK] Dependencies installed successfully
echo.

echo ============================================================
echo                   Setup Complete!
echo ============================================================
echo.
echo Available commands:
echo.
echo   [1] Development (Hot Reload):
echo       npm run electron-dev
echo.
echo   [2] Production Build:
echo       npm run electron-build
echo.
echo   [3] Start with Backend:
echo       npm run electron-start
echo.
echo Choose one and run it from the project directory!
echo.
pause
