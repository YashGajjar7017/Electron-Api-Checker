#!/bin/bash
echo "Killing all Electron and React processes..."
taskkill /f /im electron.exe 2>nul
taskkill /f /im node.exe /fi \"PID eq $PPID\" 2>nul
npx concurrently \"npm start\" \"wait-on http://localhost:3000 && electron .\" --kill-others-on-fail
