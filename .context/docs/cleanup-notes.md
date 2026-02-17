# Cleanup Notes

> Tracked observations from codebase audits. Items here are suggestions — not to be implemented without explicit approval.

---

## Future Refactor Candidates

### Duplicate Platform Constants
Platform label/color/icon mappings are defined independently in multiple files:
- `client/src/components/composer/PlatformSelector.jsx`
- `client/src/components/dashboard/PostCard.jsx`
- `client/src/pages/CalendarPage.jsx`
- `client/src/pages/AccountsPage.jsx`

**Suggestion:** Extract to a shared `client/src/constants/platforms.js` file.

### Duplicate Date Formatting
Similar `formatDate()` helpers exist in:
- `client/src/components/dashboard/PostCard.jsx` (lines 20-29)
- `client/src/components/composer/SchedulePicker.jsx` (`formatDatetimeLocal`)

**Suggestion:** Extract to a shared `client/src/utils/date.js` file.

### Unused Export: `listByUser`
`listByUser` in `api/src/services/cosmos.js` is exported but never imported anywhere. Kept because it's a useful convenience wrapper around `queryItems` that will likely be needed as the app grows.

### Unused `context` Parameter in Azure Functions
All handlers in `api/src/functions/posts.js` receive `(request, context)` but never use `context`. This is standard Azure Functions v4 signature convention — not worth changing.

---

## Completed Cleanup (Feb 2026)

- **Fixed:** CSS selector mismatch in `PostCard.css` — `.post-card-date.published` / `.scheduled` didn't match JSX classes. Corrected to `.post-card-date.post-card-published` / `.post-card-date.post-card-scheduled`.
- **Fixed:** `.filter-chip .count` in `DashboardPage.css` didn't match JSX class `filter-count`. Corrected to `.filter-count`.
- **Removed:** Empty `AppShell.css` (contained only a comment) and its import from `AppShell.jsx`.
- **Removed:** Unused `.dashboard-header-row` class from `DashboardPage.css`.
- **Removed:** Unused `.compose-section-label` and `.compose-preview-header` classes from `ComposePage.css`.
- **Replaced:** `console.log` debug statements with comments in `DashboardPage.jsx` and `cosmos.js`.
- **Fixed:** Redundant ternary `useState(DEV_MODE ? null : null)` simplified to `useState(null)` in `AuthContext.jsx`.
