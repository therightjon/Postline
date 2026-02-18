# AGENTS.md — Postline

> Instructions for AI agents working on this codebase. Read this entire file before making any changes.

---

## Local Context Folder (.context)

Use `.context/` for repository-local agent coordination artifacts (plans, notes,
and agent guidance) that should live alongside the codebase.

Current structure in this repository:

```
.context/
├── agents/
│   └── AGENTS.md                 # Agent operating guide for this repo
├── docs/                         # Supporting docs for agent workflows
└── plans/
    └── email-custom-vars-plan.md # Example implementation plan
```

Guidelines:

- Keep planning and coordination documents under `.context/plans/`.
- Keep reusable process/docs content under `.context/docs/`.
- Keep agent instruction files under `.context/agents/`.
- Prefer adding new context artifacts in `.context/` instead of cluttering
  the code directories.
- When creating new plans, use clear, feature-specific filenames
  (for example `feature-name-plan.md`).

## Core Principles

1. **Reuse first.** Always reuse existing components, hooks, forms, utilities, services, and patterns. Only extend them when genuinely needed. Never replace or invent new patterns unless no suitable option exists.
2. **Consistency over novelty.** Match the existing code style, naming conventions, file organization, and architectural patterns exactly. This codebase has clear conventions — follow them.
3. **Minimal changes.** Only make changes that are directly requested or clearly necessary. Do not refactor, "improve", or restructure code beyond the task scope. Suggest improvements in tasks completion summaries or documentation, but do not implement them without explicit instructions.
4. **Comment thoughtfully.** Add sensible comments where logic is non-obvious, and keep them updated when you change the code they describe. Do not add comments that restate what the code already says.
5. **Update docs.** When making important or significant changes, update relevant documentation (this file, README.md, or files in `.context/docs/`). Keep docs in sync with reality.
6. **Ask before assuming.** If anything is unclear — requirements, approach, scope — ask questions before making changes.

---

## Project Overview

**Postline** is a social media management app for creating, previewing, scheduling, and publishing posts to Instagram, Facebook, X (Twitter), and LinkedIn.

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite 5 (JSX, no TypeScript) |
| Backend | Azure Functions v4 (Node.js, ESM) |
| Database | Azure Cosmos DB (NoSQL) |
| Storage | Azure Blob Storage |
| Auth | Azure AD B2C (MSAL) with dev-mode bypass |
| Hosting | Azure Static Web Apps |

---

## Directory Structure

```
Postline/
├── client/                          # React frontend (Vite)
│   └── src/
│       ├── App.jsx                  # Root router + protected routes
│       ├── main.jsx                 # Entry point (ReactDOM + MSAL provider)
│       ├── index.css                # Theme variables, global styles, Oat UI overrides
│       ├── components/
│       │   ├── composer/            # Post creation: PlatformSelector, MediaUpload, SchedulePicker, CharacterCount
│       │   ├── dashboard/           # Post listing: PostCard
│       │   ├── layout/              # App shell: AppShell, Sidebar, ThemeToggle
│       │   └── preview/             # Live previews: PreviewPanel, XPreview, InstagramPreview, FacebookPreview, LinkedInPreview
│       ├── pages/                   # Route pages: DashboardPage, ComposePage, CalendarPage, AccountsPage, LoginPage
│       ├── services/                # API client (api.js), MSAL config (authConfig.js)
│       └── context/                 # AuthContext (sole React context)
│
├── api/                             # Azure Functions backend (ESM)
│   └── src/
│       ├── functions/               # HTTP + Timer triggers: posts.js, media.js, accounts.js, publish.js, scheduler.js
│       ├── middleware/              # auth.js — B2C JWT validation
│       └── services/
│           ├── cosmos.js            # Cosmos DB singleton client + CRUD helpers
│           ├── blob.js              # Blob Storage upload/delete
│           └── social/              # Per-platform publishers: twitter.js, facebook.js, instagram.js, linkedin.js
│
├── .context/                        # AI agent context, docs, plans
├── staticwebapp.config.json         # SPA routing + API passthrough config
├── dev.sh                           # Local dev runner (API + frontend)
└── README.md                        # Full project documentation
```

---

## Conventions

### File Naming
- **Components & pages:** PascalCase (`ComposePage.jsx`, `PlatformSelector.jsx`)
- **Services & utilities:** camelCase (`api.js`, `cosmos.js`, `auth.js`)
- **Stylesheets:** Same name as their component (`PostCard.jsx` → `PostCard.css`)

### Component Structure
Follow this order within every component file:

```jsx
// 1. Imports (React, libraries, local components, services, styles)
import React, { useState, useEffect } from 'react';
import { postsApi } from '../services/api';
import './ComponentName.css';

// 2. Constants (if any)
const PLATFORMS = [/* ... */];

// 3. Component (always default export, function declaration)
export default function ComponentName() {
  // State declarations
  const [value, setValue] = useState(null);

  // Effects
  useEffect(() => { /* ... */ }, []);

  // Event handlers
  const handleAction = () => { /* ... */ };

  // Render
  return ( /* JSX */ );
}
```

### CSS
- **Vanilla CSS** with one `.css` file per component (no CSS modules, no Tailwind, no CSS-in-JS)
- **CSS variables** defined in `client/src/index.css` for colors, spacing, shadows, transitions
- **BEM-like class naming** in kebab-case: `post-card`, `post-card-header`, `post-card-content`
- **Dark mode** via `data-theme="dark"` attribute on `<body>`, toggled by ThemeToggle, persisted in localStorage (`postline-theme`)
- **Oat UI** (`@knadh/oat`) provides base component styles — loaded before app CSS so custom styles can override

### Naming
- Functions and variables: `camelCase`
- Components: `PascalCase`
- Constants (arrays/objects): `UPPER_SNAKE_CASE`
- CSS classes: `kebab-case`
- Data attributes for styling: `data-variant="secondary"`, `data-status="draft"`, etc.

### Imports
- Destructured React imports: `import { useState, useEffect } from 'react'`
- Icons from lucide-react: `import { Calendar, Send } from 'lucide-react'`
- Relative paths only (no aliases): `import { postsApi } from '../services/api'`

---

## Architecture Details

### Frontend State Management
- **AuthContext** is the only React context. It wraps MSAL and provides: `user`, `isAuthenticated`, `loading`, `login()`, `logout()`, `getAccessToken()`, `devMode`
- Access it via the `useAuth()` hook (defined in `client/src/context/AuthContext.jsx`)
- All other state is local to components via `useState` — there is no Redux, Zustand, or other state library
- **Do not introduce new state management libraries** without explicit approval

### API Client
- Centralized in `client/src/services/api.js` using axios
- Token interceptor automatically attaches the Bearer token from MSAL (or `'dev-token'` in dev mode)
- Three API namespaces: `postsApi`, `mediaApi`, `accountsApi` — each with typed methods
- **Always use these existing API methods.** Do not create parallel axios instances or fetch calls.

### Backend Pattern
- Each Azure Function is in its own file under `api/src/functions/`
- Protected endpoints call `requireAuth(request)` from `api/src/middleware/auth.js` — it returns the authenticated user or a 401 response
- Database operations go through `api/src/services/cosmos.js` helpers: `createItem`, `getItem`, `updateItem`, `deleteItem`, `queryItems`, `listByUser`
- Media operations go through `api/src/services/blob.js`: `uploadMedia`, `deleteMedia`
- Social publishing is per-platform in `api/src/services/social/{platform}.js`

### Authentication
- **Production:** Azure AD B2C via MSAL — config in `client/src/services/authConfig.js`
- **Dev mode:** Auto-enabled when `VITE_B2C_CLIENT_ID` is not set. Uses mock user `dev-user-001` and mock token `'dev-token'`. Dashboard shows demo data when API is unreachable.
- Backend validates JWTs via `jwks-rsa` against the B2C JWKS endpoint. Extracts `userId` from `oid` or `sub` claims.
- All data is partitioned by `userId` in Cosmos DB

### Database
- Azure Cosmos DB NoSQL with database name `postline`
- Two containers, both partitioned by `/userId`:
  - `posts` — all post statuses (draft, scheduled, published, failed)
  - `socialAccounts` — connected OAuth accounts
- Singleton client pattern in `cosmos.js` — reuses connections across function invocations
- `initializeDatabase()` creates containers on first run if they don't exist

### Scheduling
- Timer trigger in `api/src/functions/scheduler.js` runs every minute
- Queries for posts where `status = 'scheduled'` and `scheduledAt <= now`
- Calls `publishPost()` from `api/src/functions/publish.js` for each due post
- Per-platform results are written back to the post document

---

## Existing Components Reference

Before building anything new, check if one of these already handles what you need:

### Layout
| Component | File | Purpose |
|-----------|------|---------|
| AppShell | `client/src/components/layout/AppShell.jsx` | Two-column layout (sidebar + content area) |
| Sidebar | `client/src/components/layout/Sidebar.jsx` | Navigation links, user info, logout |
| ThemeToggle | `client/src/components/layout/ThemeToggle.jsx` | Dark/light mode toggle (persists to localStorage) |

### Composer (Post Creation)
| Component | File | Purpose |
|-----------|------|---------|
| PlatformSelector | `client/src/components/composer/PlatformSelector.jsx` | Multi-select platform buttons (Instagram, Facebook, X, LinkedIn) |
| MediaUpload | `client/src/components/composer/MediaUpload.jsx` | Drag-and-drop image upload with file input fallback |
| SchedulePicker | `client/src/components/composer/SchedulePicker.jsx` | Toggle between "Publish Now" and scheduled datetime |
| CharacterCount | `client/src/components/composer/CharacterCount.jsx` | Per-platform character limit bars (Twitter: 280, IG: 2200, FB: 63206, LinkedIn: 3000) |

### Preview (Live Post Previews)
| Component | File | Purpose |
|-----------|------|---------|
| PreviewPanel | `client/src/components/preview/PreviewPanel.jsx` | Routes to platform-specific preview based on selection |
| XPreview | `client/src/components/preview/XPreview.jsx` | Twitter/X post preview with 280-char truncation |
| InstagramPreview | `client/src/components/preview/InstagramPreview.jsx` | Instagram post preview (requires image) |
| FacebookPreview | `client/src/components/preview/FacebookPreview.jsx` | Facebook post preview with reactions bar |
| LinkedInPreview | `client/src/components/preview/LinkedInPreview.jsx` | LinkedIn post preview with hashtag highlighting |

### Dashboard
| Component | File | Purpose |
|-----------|------|---------|
| PostCard | `client/src/components/dashboard/PostCard.jsx` | Post list item with status badge, platforms, dates, actions |

---

## Existing Services Reference

### Frontend (`client/src/services/api.js`)
```
postsApi.list(status?)       — GET /api/posts
postsApi.get(id)             — GET /api/posts/{id}
postsApi.create(data)        — POST /api/posts
postsApi.update(id, data)    — PUT /api/posts/{id}
postsApi.delete(id)          — DELETE /api/posts/{id}
postsApi.publish(id)         — POST /api/posts/{id}/publish

mediaApi.upload(file)        — POST /api/media (multipart FormData)

accountsApi.list()           — GET /api/accounts
accountsApi.connect(platform) — GET /api/accounts/connect/{platform}
accountsApi.disconnect(id)   — DELETE /api/accounts/{id}
accountsApi.callback(platform, params) — POST /api/accounts/callback/{platform}
```

### Backend Services
| Service | File | Key Exports |
|---------|------|-------------|
| Cosmos DB | `api/src/services/cosmos.js` | `createItem`, `getItem`, `updateItem`, `deleteItem`, `queryItems`, `listByUser`, `initializeDatabase` |
| Blob Storage | `api/src/services/blob.js` | `uploadMedia(buffer, originalName, contentType)`, `deleteMedia(blobUrl)` |
| Auth Middleware | `api/src/middleware/auth.js` | `authenticateRequest(request)`, `requireAuth(request)` |
| Twitter Publisher | `api/src/services/social/twitter.js` | `publishToTwitter(post, account)` |
| Facebook Publisher | `api/src/services/social/facebook.js` | `publishToFacebook(post, account)` |
| Instagram Publisher | `api/src/services/social/instagram.js` | `publishToInstagram(post, account)` |
| LinkedIn Publisher | `api/src/services/social/linkedin.js` | `publishToLinkedIn(post, account)` |

---

## Data Schemas

### Post
```javascript
{
  id: string,              // UUID
  userId: string,          // Partition key
  content: string,         // Post body text
  platforms: string[],     // 'instagram' | 'facebook' | 'twitter' | 'linkedin'
  mediaUrl: string | null, // Blob storage URL
  status: string,          // 'draft' | 'scheduled' | 'published' | 'failed'
  scheduledAt: string | null,  // ISO datetime
  publishedAt: string | null,  // ISO datetime
  publishResults: {        // Per-platform outcomes
    [platform]: { success: boolean, error?: string, platformPostId?: string }
  },
  error: string | null,
  createdAt: string,       // ISO datetime
  updatedAt: string        // ISO datetime
}
```

### Social Account
```javascript
{
  id: string,              // UUID
  userId: string,          // Partition key
  platform: string,        // 'facebook' | 'instagram' | 'twitter' | 'linkedin'
  platformName: string,
  platformUsername: string,
  accessToken: string,
  refreshToken: string | null,
  tokenExpiresAt: string | null,
  connectedAt: string      // ISO datetime
}
```

---

## Environment Variables

### Client (`client/.env`)
| Variable | Purpose |
|----------|---------|
| `VITE_B2C_TENANT_NAME` | Azure AD B2C tenant name |
| `VITE_B2C_CLIENT_ID` | B2C app client ID (omit for dev mode) |
| `VITE_B2C_POLICY_NAME` | B2C sign-up/sign-in policy |

### API (`api/local.settings.json`)
| Variable | Purpose |
|----------|---------|
| `COSMOS_ENDPOINT` | Cosmos DB account endpoint |
| `COSMOS_KEY` | Cosmos DB account key |
| `COSMOS_DATABASE` | Database name (`postline`) |
| `BLOB_CONNECTION_STRING` | Azure Blob Storage connection string |
| `BLOB_CONTAINER` | Blob container name (`media`) |
| `B2C_TENANT_NAME` | Azure AD B2C tenant |
| `B2C_CLIENT_ID` | B2C app client ID |
| `B2C_POLICY_NAME` | B2C policy name |
| `FACEBOOK_APP_ID` | Meta app ID |
| `FACEBOOK_APP_SECRET` | Meta app secret |
| `TWITTER_API_KEY` | X/Twitter API key |
| `TWITTER_API_SECRET` | X/Twitter API secret |
| `TWITTER_BEARER_TOKEN` | X/Twitter bearer token |
| `LINKEDIN_CLIENT_ID` | LinkedIn app client ID |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn app secret |

---

## Common Patterns

### Adding a New Page
1. Create `client/src/pages/NewPage.jsx` following the component structure convention
2. Create `client/src/pages/NewPage.css` for styles
3. Add a route in `client/src/App.jsx` inside the `ProtectedRoute` wrapper
4. Add a navigation link in `client/src/components/layout/Sidebar.jsx`

### Adding a New Component
1. Place it in the appropriate feature directory under `client/src/components/`
2. Create a matching `.css` file in the same directory
3. Use CSS variables from `index.css` for colors, spacing, shadows
4. Export as `export default function ComponentName()`

### Adding a New API Endpoint
1. Create or extend a function file in `api/src/functions/`
2. Use `requireAuth(request)` for protected endpoints
3. Use cosmos.js helpers for database operations
4. Add a corresponding method in `client/src/services/api.js` under the appropriate namespace
5. Update README.md API Reference table

### Adding a New Social Platform Publisher
1. Create `api/src/services/social/{platform}.js` exporting `publishTo{Platform}(post, account)`
2. Add the platform to the publish logic in `api/src/functions/publish.js`
3. Add platform config (character limits, color) to frontend components: `CharacterCount.jsx`, `PlatformSelector.jsx`, `PreviewPanel.jsx`
4. Create a preview component in `client/src/components/preview/`

### Form Handling
- Use raw `useState` for form fields — no form libraries
- Validate inline (e.g., `content.trim().length > 0 && platforms.length > 0`)
- File uploads: hidden `<input type="file">` with drag-and-drop wrapper, processed via `mediaApi.upload()`

### Error Handling
- Frontend: `try/catch` with `console.error` and user-facing alerts/state
- Backend: Return JSON error objects with appropriate HTTP status codes
- Demo mode fallback: Dashboard and Composer show demo data when API is unreachable

---

## What NOT to Do

- **Do not introduce TypeScript.** This is a JavaScript/JSX project.
- **Do not add state management libraries** (Redux, Zustand, Jotai, etc.) without approval.
- **Do not add form libraries** (React Hook Form, Formik, etc.) without approval.
- **Do not add CSS frameworks** (Tailwind, styled-components, etc.). Use vanilla CSS matching existing patterns.
- **Do not create new axios instances** or use raw `fetch`. Use the existing `api.js` client.
- **Do not bypass the auth middleware** on protected endpoints.
- **Do not store secrets in code.** Use environment variables.
- **Do not add testing infrastructure** without approval (none is currently configured).
- **Do not modify the Cosmos DB partition key strategy** (`/userId`) without understanding the implications.
- **Do not create new React contexts** without justification. Local state and prop drilling are preferred for most cases.

---

## Local Development

```bash
# Install dependencies
cd client && npm install
cd ../api && npm install

# Run (two terminals, or use dev.sh)
cd api && func start          # Terminal 1: Azure Functions on :7071
cd client && npm run dev      # Terminal 2: Vite dev server on :5173

# Or use the dev runner script
./dev.sh
```

The Vite dev server proxies `/api/*` requests to `localhost:7071`. Dev mode (no Azure services needed) activates automatically when `VITE_B2C_CLIENT_ID` is not set.
