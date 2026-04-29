#!/bin/bash

# API Checker - Quick Setup Script
# This script sets up and runs the API Checker application

echo "╔════════════════════════════════════════════════════════════╗"
echo "║           API Checker - Application Setup                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    Setup Complete!                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Available commands:"
echo ""
echo "  🚀 Development (Hot Reload):"
echo "     npm run electron-dev"
echo ""
echo "  🔨 Production Build:"
echo "     npm run electron-build"
echo ""
echo "  🎯 Start with Backend:"
echo "     npm run electron-start"
echo ""
echo "Choose one and run it from the project directory!"
echo ""
