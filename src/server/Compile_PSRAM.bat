@echo off
setlocal enabledelayedexpansion

:: ==============================
:: Arduino ESP32-S3 Build Script
:: Usage:
:: build_upload.bat "project_path" COMx jobs
:: Example:
:: build_upload.bat "D:\Coding\IOT\Test" COM5 8
:: ==============================

if "%~1"=="" (
    echo Usage:
    echo build_upload.bat "project_path" COMx jobs
    pause
    exit /b 1
)

:: Inputs
set PROJECT=%~1
set PORT=%~2
set JOBS=%~3

:: Defaults
if "%PORT%"=="" set PORT=COM3
if "%JOBS%"=="" set JOBS=8

:: Board
set FQBN=esp32:esp32:esp32s3

:: ==============================
:: PSRAM Selection
:: ==============================
echo.
echo ==============================
echo Select PSRAM Mode
echo ==============================
echo 1. Disable PSRAM
echo 2. Enable QSPI PSRAM
echo 3. Enable OPI PSRAM (ESP32-S3 N16R8)
echo ==============================

set /p PSRAM_CHOICE=Enter Choice [1-3]:

if "%PSRAM_CHOICE%"=="1" (
    set PSRAM_OPTION=
    set PSRAM_NAME=Disabled
)

if "%PSRAM_CHOICE%"=="2" (
    set PSRAM_OPTION=--board-options "PSRAM=enabled"
    set PSRAM_NAME=QSPI Enabled
)

if "%PSRAM_CHOICE%"=="3" (
    set PSRAM_OPTION=--board-options "PSRAM=opi"
    set PSRAM_NAME=OPI Enabled
)

:: Default if invalid input
if not defined PSRAM_NAME (
    set PSRAM_OPTION=--board-options "PSRAM=opi"
    set PSRAM_NAME=OPI Enabled (Default)
)

:: Build folder
set BUILD=%PROJECT%\build

echo.
echo ===============================
echo Project : %PROJECT%
echo Port    : %PORT%
echo Threads : %JOBS%
echo Board   : %FQBN%
echo PSRAM   : %PSRAM_NAME%
echo ===============================
echo.

:: ==============================
:: Compile
:: ==============================
color a
echo [1/2] Compiling...

arduino-cli compile ^
 --fqbn %FQBN% ^
 %PSRAM_OPTION% ^
 --build-path "%BUILD%" ^
 --jobs %JOBS% ^
 --build-property build.debug_level=none ^
 "%PROJECT%"

if errorlevel 1 (
    color c
    echo.
    echo ======================
    echo COMPILATION FAILED
    echo ======================
    pause
    exit /b 1
)

echo.
echo Compilation successful
echo.

:: ==============================
:: Upload
:: ==============================
echo [2/2] Uploading...

arduino-cli upload ^
 -p %PORT% ^
 --fqbn %FQBN% ^
 --upload-property upload.speed=921600 ^
 --input-dir "%BUILD%"

if errorlevel 1 (
    color c
    echo.
    echo ======================
    echo UPLOAD FAILED
    echo ======================
    echo If board did not auto-reset:
    echo Hold BOOT button and retry
    pause
    exit /b 1
)

echo.
echo ======================
echo UPLOAD SUCCESSFUL
echo ======================

:: ==============================
:: Serial Monitor
:: ==============================
color f
echo.
echo ======================
echo OPENING SERIAL MONITOR
echo ======================
echo Opening Serial Monitor...

arduino-cli monitor ^
 -p %PORT% ^
 -c baudrate=115200