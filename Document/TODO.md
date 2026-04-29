# Fix Import / Remove Data Bug — Implementation TODO

## Plan Approved

- [x] 1. Update `src/components/Sidebar.jsx`
  - Add per-API delete button (trash icon) next to each API item.
  - Fix `handleFileImport` to **replace** APIs in the target collection instead of appending.
  - Add `window.confirm` before replacing collection data on import.
  - Wrap individual `JSON.parse` calls for `headers`, `params`, `auth` in `try/catch` so one bad row doesn't crash the whole import.
  - Ensure `window.electronAPI.saveAPIs` is called after bulk API changes.
- [x] 2. Verify `src/store.js` exposes `deleteAPI` and `setAPIs` correctly.
- [x] 3. Test import flow and single-API deletion.

