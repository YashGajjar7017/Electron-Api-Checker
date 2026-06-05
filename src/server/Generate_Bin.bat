@echo off
title ESP32 BIN Generator

echo ==========================================
echo      ESP32 Arduino BIN Generator
echo ==========================================
echo.

:: Ask for input path
set /p INPUT_PATH=Enter Input Sketch Folder Path: 

:: Ask for output path
set /p OUTPUT_PATH=Enter Output Folder Path: 

:: Ask for ino file name
set /p INO_FILE=Enter .ino File Name (example: main.ino): 

echo.
echo ==========================================
echo Compiling Arduino Sketch...
echo ==========================================

:: Change directory to sketch folder
cd /d "%INPUT_PATH%"

:: Compile and generate BIN
arduino-cli compile ^
--fqbn esp32:esp32:esp32 ^
"%INO_FILE%" ^
--output-dir "%OUTPUT_PATH%"

echo.
echo ==========================================
echo Build Finished
echo ==========================================

:: Check success
if exist "%OUTPUT_PATH%\%INO_FILE%.bin" (
    echo BIN Generated Successfully:
    echo %OUTPUT_PATH%\%INO_FILE%.bin
) else (
    echo Failed to Generate BIN
)

pause