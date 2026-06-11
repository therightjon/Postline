# Local Development

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local) v4 (`npm i -g azure-functions-core-tools@4`)

## Quickstart

```bash
npm run install:all   # installs client + api dependencies
./dev.sh              # starts API (:7071) and app (:5173) together
```

Open http://localhost:5173 and click **Enter Dev Mode** — with `ALLOW_DEV_AUTH=true` (the default in `api/local.settings.json`) no auth setup is needed locally. The dev bypass is hard-disabled in production.

The Vite dev server proxies `/api/*` to `http://localhost:7071`, so no CORS or base-URL config is needed.

## Configuration

Copy [api/local.settings.example.json](../api/local.settings.example.json) to `api/local.settings.json` (gitignored) and fill in what you need:

- **Nothing** — UI + dev session work with no settings at all (API calls that need Cosmos/Blob will fail until configured).
- **Cosmos + Blob** — point at a real (free-tier) Azure account, or the emulators (see docker-compose).
- **Password login locally** — set `ADMIN_PASSWORD_HASH` (`node scripts/hash-password.mjs --generate`).
- **Platform keys** — same variables as production; see [configuration.md](configuration.md). Note that most platforms reject `http://localhost` callbacks; for full OAuth testing use a tunnel (e.g. `ngrok`) or a deployed instance.

## docker-compose (experimental)

```bash
docker compose up --build
```

Brings up Azurite (blob), the Cosmos emulator (vnext-preview), the API container, and the Vite dev server. Read the caveats at the top of [docker-compose.yml](../docker-compose.yml) — the Cosmos emulator can be flaky (especially on ARM Macs), and media *publishing* requires a real storage account because media URLs are enforced HTTPS-only. The supported path is `dev.sh`; compose is a convenience starting point.

## Verifying changes

There is no test suite yet. The conventions used so far:

```bash
# API: syntax-check everything
cd api && find src -name '*.js' -print0 | xargs -0 -n1 node --check

# Client: production build
npm --prefix client run build
```

plus targeted smoke scripts for security-sensitive modules (see git history for examples). CI runs the same checks.
