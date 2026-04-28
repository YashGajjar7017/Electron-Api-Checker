# API Checker Enhancement TODO

## Plan Approved — Implementation Steps

- [x] 1. Update `public/electron.js` — Add IPC handlers: `send-request`, `save-apis`, `load-apis`
- [x] 2. Update `public/preload.js` — Expose `sendRequest`, `saveAPIs`, `loadAPIs`
- [x] 3. Update `src/store.js` — Add `sessionToken`, `sessionTokenExpiry`, `setSessionToken`, `clearSessionToken`
- [x] 4. Update `src/App.jsx` — Load `collections` and `apis` from disk on startup
- [x] 5. Update `src/components/Sidebar.jsx` — Auto-save `apis`, ensure collections load into store
- [x] 6. Create `src/components/OTPModal.jsx` — OTP input dialog component
- [x] 7. Create `src/styles/OTPModal.css` — Styles for OTP modal
- [x] 8. Update `src/components/RequestBuilder.jsx` — Use IPC for requests, integrate OTP flow

