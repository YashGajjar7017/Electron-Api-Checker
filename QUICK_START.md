# 🚀 Quick Start Guide - API Checker

## Prerequisites
- Node.js 14+ (Download from https://nodejs.org/)
- npm 6+ (comes with Node.js)

## Installation Steps

### 1. Install Dependencies
```bash
npm install
```

This will install all required packages including Electron, React, Monaco Editor, and more.

### 2. Start Development Mode
```bash
npm run electron-dev
```

Wait for both the React dev server and Electron app to launch. You should see:
- React app running on http://localhost:3000
- Electron window opening automatically

### 3. First Time Usage
1. **Sign Up**: Use any email and password to create an account
2. **Create Collection**: Click "+" in the Collections sidebar
3. **Add API**: Click "+" next to a collection
4. **Configure API**: 
   - Set HTTP method
   - Enter endpoint path (e.g., `/api/users`)
   - Add headers, body, or auth if needed
5. **Send Request**: Click "Send" button
6. **View Response**: Check the right panel for results

## Available Commands

| Command | Purpose |
|---------|---------|
| `npm run electron-dev` | Start development mode (hot-reload) |
| `npm start` | Start React dev server only |
| `npm run build` | Build React for production |
| `npm run electron-build` | Build Electron app for distribution |
| `npm test` | Run tests |

## Features Overview

### 📁 Collections Management
- Create collections to organize APIs
- Expand/collapse collections to see APIs
- Add multiple APIs per collection
- Delete collections and APIs

### 🔧 Request Builder
- Choose HTTP method (GET, POST, PUT, PATCH, DELETE)
- Enter endpoint path
- Add JSON request body with syntax highlighting
- Add custom headers
- Add query parameters
- Configure authentication (Bearer token or Basic auth)

### 📊 Response Viewer
- View response status code and time
- Inspect response headers
- View formatted JSON or raw response
- Copy responses to clipboard
- Expand/collapse individual responses

### ⚡ Batch Testing
- Run all APIs in a collection sequentially
- See results appear one-by-one
- Each result is collapsible for easy management
- Check response times and sizes

### 🎨 Theme
- Toggle between Dark and Light themes
- Smooth transitions
- Persistent theme preference (coming soon)

## Example API Collection

Here's how to set up a simple collection:

1. **Create Collection**: "JSONPlaceholder"
2. **Add API 1**:
   - Name: "Get Posts"
   - Method: GET
   - Endpoint: `/posts`
   - Server URL: `https://jsonplaceholder.typicode.com`
   - Send and view response

3. **Add API 2**:
   - Name: "Get Users"
   - Method: GET
   - Endpoint: `/users`
   - Send and view response

4. **Run Batch Test**: See all results together

## Configuration

### Setting Base Server URL
The base URL is configured in the header. All endpoint paths are appended to this.

Example:
```
Base URL: http://localhost:3000
Endpoint: /api/posts
Full URL: http://localhost:3000/api/posts
```

### Authentication
Each API can have authentication configured:

**Bearer Token**:
```
Auth Type: Bearer Token
Token: your_auth_token_here
```

**Basic Auth**:
```
Auth Type: Basic Auth
Token: base64_encoded_credentials
```

## Keyboard Shortcuts

- `Cmd/Ctrl + Q`: Exit application
- `Cmd/Ctrl + R`: Reload application
- `Cmd/Ctrl + Shift + I`: Open DevTools (developer mode)

## Data Storage

All data is stored locally:
- Collections: `~/.api-checker/collections.json`
- User info: `~/.api-checker/user.json`

(On Windows, this is typically `C:\Users\[YourName]\.api-checker\`)

## Troubleshooting

### Dependencies Installation Failed
```bash
# Clear npm cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### React Dev Server Won't Start
```bash
# Check if port 3000 is already in use
# Kill the process and try again
# See README.md for platform-specific instructions
```

### Electron Won't Launch
```bash
# Try running in development mode
npm run electron-dev

# Or check DevTools for errors
# Press F12 after app launches
```

### API Requests Failing
1. Verify base server URL is correct
2. Check endpoint path starts with `/`
3. Verify your API is actually running
4. Check response in DevTools Network tab
5. Ensure proper authentication if needed

## Next Steps

1. **Explore the UI**: Take time to familiarize yourself with the interface
2. **Test with a Real API**: Try with a public API like JSONPlaceholder
3. **Create Collections**: Organize your own APIs
4. **Use Batch Testing**: Compare multiple API responses
5. **Export Settings**: (Feature coming soon)

## Need Help?

- Check the main [README.md](./README.md) for detailed documentation
- Open DevTools (F12) to inspect the application
- Check the browser console for error messages

---

**Happy API Testing! 🎉**
