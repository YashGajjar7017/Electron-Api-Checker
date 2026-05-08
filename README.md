# 🚀 API Checker - Modern API Testing Desktop Application

A beautiful, modern Electron + React desktop application for API testing and management with a polished glassmorphism UI.
<hr>
<img width="1919" height="1008" alt="image" src="https://github.com/user-attachments/assets/dfdb3014-f837-4ba6-b915-829e2aa30f5b" />
<hr>
<img width="1919" height="1036" alt="image" src="https://github.com/user-attachments/assets/3273809f-6778-46d0-a96c-154397546537" />
<hr>
<img width="1919" height="1029" alt="image" src="https://github.com/user-attachments/assets/ef161830-45c0-4a9a-b21d-20816745beba" />
<hr>

## ✨ Features

### 🎯 Core Features
- **3-Panel Layout**: Sidebar for collections, center workspace for requests, right panel for responses
- **API Collections Management**: Organize APIs into collections with expand/collapse tree view
- **Request Builder**: Full-featured request builder with method, headers, params, body, and auth
- **Response Viewer**: Beautiful response visualization with expandable/collapsible results
- **Batch Testing**: Run all APIs sequentially with live progress tracking
- **Token Management**: Support for Bearer tokens and Basic auth
- **Side-by-side Response Comparison**: Compare multiple API responses

### 🎨 UI/UX
- **Glassmorphism Design**: Beautiful frosted glass effect with backdrop blur
- **Dark & Light Themes**: Toggle between themes with smooth transitions
- **Gradient Backgrounds**: Modern gradient color scheme throughout
- **Smooth Animations**: Hover effects, transitions, and loading states
- **Monaco Editor Integration**: JSON code editor with syntax highlighting and validation

### 💾 Data Management
- **Local Storage**: Save collections and configurations locally
- **Persistent Sessions**: Automatically restore user session on launch
- **Export/Import**: Save and load API collections (ready for extension)

### 🔐 Authentication
- **Login & Signup**: Simple authentication system
- **Session Management**: Secure user session handling
- **Local Data Storage**: All data stored securely on user's machine

## 🛠️ Tech Stack

- **Electron 27**: Desktop application framework
- **React 18**: UI library
- **Zustand**: State management
- **Monaco Editor**: Code editor for JSON
- **Axios/Fetch**: HTTP client
- **CSS3**: Modern styling with glassmorphism

## 📦 Installation

1. **Clone/Extract the project**
```bash
cd API_Checker
```

2. **Install dependencies**
```bash
npm install
```

## 🚀 Development

Start the development environment:

```bash
npm run electron-dev
```

This will:
- Start the React development server on port 3000
- Launch the Electron app pointing to the dev server
- Open DevTools automatically

## 🏗️ Building

### Production Build
```bash
npm run electron-build
```

This creates optimized builds for:
- macOS (.dmg, .zip)
- Windows (.exe, .msi)
- Linux (.AppImage, .deb)

### React Build Only
```bash
npm run build
```

## 📁 Project Structure

```
API_Checker/
├── public/
│   ├── electron.js           # Electron main process
│   ├── preload.js            # Context bridge for IPC
│   └── index.html            # React entry point
├── src/
│   ├── components/
│   │   ├── AuthScreen.jsx    # Login/Signup UI
│   │   ├── MainLayout.jsx    # 3-panel layout
│   │   ├── Header.jsx        # App header with server URL
│   │   ├── Sidebar.jsx       # Collections tree
│   │   ├── RequestBuilder.jsx # Request editor
│   │   └── ResponseViewer.jsx # Response display
│   ├── styles/
│   │   ├── index.css         # Global styles with glassmorphism
│   │   ├── App.css           # App theme styles
│   │   ├── AuthScreen.css    # Auth page styles
│   │   ├── Header.css        # Header styles
│   │   ├── Sidebar.css       # Sidebar styles
│   │   ├── RequestBuilder.css # Request panel styles
│   │   ├── ResponseViewer.css# Response panel styles
│   │   └── MainLayout.css    # Layout styles
│   ├── App.jsx               # Main app component
│   ├── store.js              # Zustand store
│   ├── index.js              # React entry point
│   └── wait.js               # Wait utility for dev server
├── package.json              # Dependencies and scripts
└── README.md                 # This file
```

## 🎮 Usage

### 1. Authentication
- Sign up with any email and password
- Session persists across app restarts

### 2. Create Collections
- Click the "+" button in the Collections sidebar
- Collections organize related APIs

### 3. Add APIs
- Click "+" next to a collection to add an API
- Set HTTP method (GET, POST, PUT, PATCH, DELETE)
- Enter endpoint path (e.g., `/api/users`)

### 4. Configure Requests
- **Body Tab**: Write JSON request body
- **Headers Tab**: Add custom headers
- **Params Tab**: Add query parameters
- **Auth Tab**: Configure Bearer token or Basic auth

### 5. Send Requests
- Click "Send" button to execute the request
- View response in right panel with:
  - Status code and response time
  - Response headers
  - Pretty JSON or raw view

### 6. Batch Testing
- Click "Batch Test" button
- Automatically executes all APIs sequentially
- Results appear in order with expand/collapse

### 7. Theme Toggle
- Use theme button in header (☀️/🌙)
- Seamlessly switch between dark and light themes

## 🎨 UI Components

### Glassmorphism Effect
```css
.glass {
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 12px;
}
```

### Gradient Buttons
- Primary: Purple to indigo
- Secondary: Pink to purple
- Success: Green gradient
- Danger: Red gradient

### Color Scheme
**Dark Theme (Default)**
- Primary: #6366f1 (Indigo)
- Secondary: #ec4899 (Pink)
- Accent: #8b5cf6 (Purple)
- BG Primary: #0f172a (Dark Blue)
- BG Secondary: #1e293b (Slate)

**Light Theme**
- Same accents with light backgrounds
- High contrast text colors

## 🔧 Configuration

### Server URL
Set the base server URL in the header input. This is prepended to all API endpoints.

Example:
- Base URL: `http://localhost:3000`
- Endpoint: `/api/users`
- Full URL: `http://localhost:3000/api/users`

### Authentication
Each API can have:
- **None**: No authentication
- **Bearer Token**: Authorization header with token
- **Basic Auth**: Base64 encoded credentials

## 💡 Tips & Tricks

1. **Keyboard Shortcuts**
   - `Cmd/Ctrl + Q`: Exit app
   - `Enter` in name input: Save name

2. **Request History**
   - All responses are stored in session
   - Expand/collapse responses to manage space
   - Copy response bodies with one click

3. **JSON Formatting**
   - Monaco Editor automatically formats JSON
   - Paste JSON to auto-format
   - Syntax highlighting for easy reading

4. **Testing Multiple APIs**
   - Use Batch Test for comparing responses
   - Results are collapsible for easy review
   - Response times help identify slow endpoints

## 📝 Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Exit | Ctrl+Q | Cmd+Q |
| Toggle Dev Tools | F12 | Cmd+Opt+I |
| Reload | Ctrl+R | Cmd+R |

## 🐛 Troubleshooting

### Port 3000 Already in Use
```bash
# Kill process using port 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux:
lsof -ti:3000 | xargs kill -9
```

### Electron Won't Launch
1. Clear cache: Remove `node_modules` and reinstall
2. Check Node version: Use Node 14+
3. Run in dev mode: `npm run electron-dev`

### API Requests Failing
1. Check base server URL is correct
2. Verify endpoint path is correct
3. Check authentication credentials
4. Verify request headers
5. Open DevTools (F12) to see network requests

## 🚀 Future Enhancements

- [ ] Import/Export Postman collections
- [ ] Environment variables
- [ ] Request/Response interceptors
- [ ] Performance testing suite
- [ ] API documentation generator
- [ ] WebSocket support
- [ ] gRPC testing
- [ ] Database connection management
- [ ] Cloud sync for collections
- [ ] Team collaboration features

## 📄 License

MIT

## 👨‍💻 Author

API Checker Team

---

**Built with ❤️ using Electron + React**

For issues or suggestions, please create an issue or submit a PR!
