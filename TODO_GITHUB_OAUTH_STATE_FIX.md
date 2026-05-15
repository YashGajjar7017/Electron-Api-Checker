# TODO_GITHUB_OAUTH_STATE_FIX

- [ ] Update `src/components/GitHubAuth.jsx`
  - [ ] Remove `window.addEventListener('message', ...)` callback logic
  - [ ] Use a single `code/state` parse from `window.location.search`
  - [ ] Use cryptographically strong `state` generation (`crypto.getRandomValues`)
  - [ ] Pass `state` along with `code` to backend
  - [ ] Clear one-time `state` after successful validation

- [ ] Update `src/server/backend.js`
  - [ ] Accept `state` in `POST /api/auth/github/callback`
  - [ ] Enforce state match (store a pending state nonce from initiation; remove after use)
  - [ ] Return 401 on mismatch

- [ ] Run lint/tests/build if available

