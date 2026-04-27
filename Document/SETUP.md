# API Checker - Setup & Installation Guide

## System Requirements

### Minimum Requirements
- **OS**: Windows 10+, macOS 10.12+, or Linux (Ubuntu 18.04+)
- **Node.js**: Version 14.0.0 or higher
- **npm**: Version 6.0.0 or higher
- **RAM**: 2GB minimum (4GB recommended)
- **Disk Space**: 500MB for installation + dependencies

### Recommended Setup
- Node.js 18.x LTS (https://nodejs.org/)
- macOS 12+, Windows 11, or latest Ubuntu
- 4GB+ RAM
- SSD for faster performance

## Installation

### Step 1: Download & Navigate to Project
```bash
# Navigate to the project directory
cd d:\Coding\Electron\API_Checker

# Or from anywhere:
cd API_Checker
```

### Step 2: Install Dependencies
```bash
npm install
```

This installs:
- Electron (desktop framework)
- React (UI library)
- React-Scripts (build tools)
- Monaco Editor (code editor)
- Zustand (state management)
- React Icons (icon library)
- Additional utilities

**Installation time**: 2-5 minutes depending on internet speed

### Step 3: Start Development

#### Option A: Development Mode (with Hot Reload)
```bash
npm run electron-dev
```

This will:
1. Start React development server on `http://localhost:3000`
2. Wait for dev server to be ready
3. Launch Electron app automatically
4. Open DevTools for debugging

#### Option B: Production Build
```bash
npm run electron-build
```

This creates a distributable application for your OS.

## Project Structure

```
API_Checker/
│
├── public/
│   ├── electron.js          # Electron main process
│   ├── preload.js           # Security context bridge
│   ├── index.html           # React mount point
│   └── package.json         # Electron config
│
├── src/
│   ├── components/
│   │   ├── AuthScreen.jsx       # Login/Signup UI
│   │   ├── MainLayout.jsx       # 3-panel layout wrapper
│   │   ├── Header.jsx           # Top header bar
│   │   ├── Sidebar.jsx          # Collection tree (left)
│   │   ├── RequestBuilder.jsx   # Request editor (center)
│   │   └── ResponseViewer.jsx   # Response display (right)
│   │
│   ├── styles/
│   │   ├── index.css            # Global styles & theme
│   │   ├── App.css              # App-level styles
│   │   ├── AuthScreen.css       # Auth page
│   │   ├── Header.css           # Header styling
│   │   ├── Sidebar.css          # Collections panel
│   │   ├── RequestBuilder.css   # Request panel
│   │   ├── ResponseViewer.css   # Response panel
│   │   └── MainLayout.css       # Layout structure
│   │
│   ├── App.jsx              # Main app component
│   ├── store.js             # Zustand state management
│   ├── index.js             # React entry point
│   └── wait.js              # Dev server wait utility
│
├── package.json             # Dependencies & scripts
├── README.md                # Full documentation
├── QUICK_START.md           # Quick start guide
├── SETUP.md                 # This file
└── .gitignore              # Git ignore rules
```

## Configuration

### Authentication
Edit `src/store.js` to customize auth logic:
```javascript
loginUser: (user) => set({ user, isAuthenticated: true })
```

### API Configuration
Edit `public/electron.js` to customize:
- Data storage location
- App window size
- Menu options

### Theme Colors
Edit `src/styles/index.css`:
```css
:root {
  --primary: #6366f1;        /* Change app primary color */
  --secondary: #ec4899;      /* Change secondary color */
  --bg-primary: #0f172a;     /* Dark theme background */
  /* ... more colors ... */
}
```

## Available npm Scripts

### Development
```bash
npm run electron-dev      # Development mode with hot reload
npm run start             # React dev server only
npm run electron          # Electron app only (requires npm start in another terminal)
```

### Building
```bash
npm run build             # Build React for production
npm run electron-build    # Build entire Electron app
npm run electron-pack     # Package for Windows, Mac, Linux
```

### Testing
```bash
npm test                  # Run tests
npm run eject            # Eject from create-react-app (⚠️ irreversible)
```

## Troubleshooting

### Issue: "npm: command not found"
**Solution**: Install Node.js from https://nodejs.org/

### Issue: Port 3000 already in use
**Windows**:
```bash
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**Mac/Linux**:
```bash
lsof -ti:3000 | xargs kill -9
```

### Issue: Modules not found
```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

### Issue: Electron won't start
1. Check that port 3000 is available
2. Verify Node.js installation: `node -v`
3. Check for .api-checker directory permissions
4. Open DevTools (F12) to see error messages

### Issue: API requests fail (CORS errors)
1. Ensure your API server is running
2. Check the base URL in header is correct
3. If testing local API, ensure it's on localhost
4. Verify authentication credentials if needed

## First Time Setup Checklist

- [ ] Node.js 14+ installed (`node -v`)
- [ ] npm 6+ installed (`npm -v`)
- [ ] Project downloaded/cloned
- [ ] In project directory (`cd API_Checker`)
- [ ] Dependencies installed (`npm install`)
- [ ] Development server started (`npm run electron-dev`)
- [ ] Electron app opened successfully
- [ ] Created test collection
- [ ] Added test API
- [ ] Sent test request
- [ ] Received response

## Performance Tips

1. **Reduce Animation**: (Coming in next update)
2. **Clear Response History**: Click trash icon to free memory
3. **Limit Collections**: Keep to <100 active collections for best performance
4. **Close Unnecessary Responses**: Collapse expanded responses
5. **Monitor DevTools**: Open F12 to check performance

## Security Notes

⚠️ **Important**:
- Auth tokens are stored only locally (in user home directory)
- Never share your user data file
- Use HTTPS for production APIs
- Be careful with sensitive credentials in request bodies
- Use environment variables for sensitive data (coming soon)

## Development Tips

1. **Hot Reload**: Changes to React code reload automatically
2. **DevTools**: Press F12 to inspect app
3. **Console Logs**: Check browser console in DevTools
4. **Zustand DevTools**: Install Redux DevTools extension for state debugging
5. **Component Inspector**: Use React DevTools extension

## Building for Production

### macOS
```bash
npm run electron-pack
# Creates: dist/API\ Checker-1.0.0.dmg
```

### Windows
```bash
npm run electron-pack
# Creates: dist/API Checker Setup 1.0.0.exe
```

### Linux
```bash
npm run electron-pack
# Creates: dist/api-checker-1.0.0.AppImage
```

## Next Steps

1. ✅ Complete [QUICK_START.md](./QUICK_START.md) for basic usage
2. 📖 Read [README.md](./README.md) for full feature documentation
3. 🧪 Test with public APIs like JSONPlaceholder
4. 🎨 Customize theme colors in `src/styles/index.css`
5. 🚀 Build for distribution: `npm run electron-build`

## Getting Help

### Resources
- **Electron Docs**: https://www.electronjs.org/docs
- **React Docs**: https://react.dev
- **Monaco Editor**: https://microsoft.github.io/monaco-editor/
- **Zustand**: https://github.com/pmndrs/zustand

### Common Issues
Check the troubleshooting section above or see QUICK_START.md

---

**Setup Complete! Ready to build amazing API tests! 🎉**
