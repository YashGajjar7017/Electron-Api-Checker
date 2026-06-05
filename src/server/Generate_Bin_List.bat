@echo off
setlocal enabledelayedexpansion
title ESP32 IoT Build System

:MENU
cls
echo ====================================================
echo              ESP32 IoT Build System
echo ====================================================
echo.
echo 1. Generate BIN Only
echo 2. Compile Sketch Only
echo 3. Compile ^& Upload on COM Port
echo 4. Generate BIN ^& Upload
echo 5. Clean Output Folder
echo 6. Show Connected COM Ports
echo 7. Exit
echo.
set /p OPTION=Select Option [1-7]: 

if "%OPTION%"=="1" goto BIN_ONLY
if "%OPTION%"=="2" goto COMPILE_ONLY
if "%OPTION%"=="3" goto COMPILE_UPLOAD
if "%OPTION%"=="4" goto BIN_UPLOAD
if "%OPTION%"=="5" goto CLEAN_BUILD
if "%OPTION%"=="6" goto SHOW_PORTS
if "%OPTION%"=="7" exit

echo Invalid Selection
timeout /t 2 >nul
goto MENU


:: ==========================================
:: COMMON INPUT FUNCTION
:: ==========================================
:GET_INPUT
echo.
set /p INPUT_PATH=Enter Sketch Folder Path: 
set /p OUTPUT_PATH=Enter Output Folder Path: 
set /p INO_FILE=Enter INO File Name (example main.ino): 
goto :eof


:: ==========================================
:: 1. GENERATE BIN ONLY
:: ==========================================
:BIN_ONLY
cls
echo ===== Generate BIN Only =====
call :GET_INPUT

cd /d "%INPUT_PATH%"

arduino-cli compile ^
--fqbn esp32:esp32:esp32 ^
"%INO_FILE%" ^
--export-binaries ^
--output-dir "%OUTPUT_PATH%"

echo.
echo BIN Generation Completed
pause
goto MENU


:: ==========================================
:: 2. COMPILE ONLY
:: ==========================================
:COMPILE_ONLY
cls
echo ===== Compile Sketch Only =====
call :GET_INPUT

cd /d "%INPUT_PATH%"

arduino-cli compile ^
--fqbn esp32:esp32:esp32 ^
"%INO_FILE%"

echo.
echo Compile Completed
pause
goto MENU


:: ==========================================
:: 3. COMPILE + UPLOAD
:: ==========================================
:COMPILE_UPLOAD
cls
echo ===== Compile + Upload =====
call :GET_INPUT

set /p COM_PORT=Enter COM Port (example COM5): 

cd /d "%INPUT_PATH%"

arduino-cli compile ^
--fqbn esp32:esp32:esp32 ^
"%INO_FILE%"

arduino-cli upload ^
-p %COM_PORT% ^
--fqbn esp32:esp32:esp32 ^
"%INPUT_PATH%"

echo.
echo Upload Completed
pause
goto MENU


:: ==========================================
:: 4. BIN + UPLOAD
:: ==========================================
:BIN_UPLOAD
cls
echo ===== Generate BIN + Upload =====
call :GET_INPUT

set /p COM_PORT=Enter COM Port (example COM5): 

cd /d "%INPUT_PATH%"

arduino-cli compile ^
--fqbn esp32:esp32:esp32 ^
"%INO_FILE%" ^
--export-binaries ^
--output-dir "%OUTPUT_PATH%"

arduino-cli upload ^
-p %COM_PORT% ^
--fqbn esp32:esp32:esp32 ^
"%INPUT_PATH%"

echo.
echo BIN Generated and Uploaded
pause
goto MENU


:: ==========================================
:: 5. CLEAN OUTPUT
:: ==========================================
:CLEAN_BUILD
cls
echo ===== Clean Output Folder =====
set /p OUTPUT_PATH=Enter Output Folder Path: 

if exist "%OUTPUT_PATH%" (
    del /q "%OUTPUT_PATH%\*.*"
    echo Output Folder Cleaned
) else (
    echo Folder Not Found
)

pause
goto MENU


:: ==========================================
:: 6. SHOW COM PORTS
:: ==========================================
:SHOW_PORTS
cls
echo ===== Available COM Ports =====
wmic path Win32_SerialPort get DeviceID,Name
echo.
pause
goto MENU