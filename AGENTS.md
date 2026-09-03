# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome extension (Manifest V3) that adds torrents to qBittorrent instances via a qui server. Right-click a magnet/torrent link, pick an instance and category from nested context menus, and receive a notification confirming the torrent was added. A second menu, "Cross-seed in qui", sends a `.torrent` link to qui's manual cross-seed flow through a picker window.

## Commands

```bash
bun install             # Install dependencies
bun run dev             # Dev server with HMR (Chrome)
bun run dev:firefox     # Dev server (Firefox)
bun run build           # Production build (Chrome)
bun run build:firefox   # Production build (Firefox)
bun run zip             # Package for Chrome Web Store
bun run zip:firefox     # Package for Firefox
bun run submit          # Build and upload to both stores; needs .env.submit
```

`bun test` runs the unit tests in `test/`. No lint command is configured.

### WXT

`postinstall` runs `wxt prepare`, which writes the generated types and the base `tsconfig.json` to `.wxt/`. `bun run typecheck` needs them. `wxt.config.ts` holds the manifest; the version comes from `package.json`. Builds land in `.output/chrome-mv3` and `.output/firefox-mv3`.

## Workflow

- Update CHANGELOG.md for every commit.

## Architecture

Built with **WXT** (Vite-based extension framework), **React 19**, **Radix Themes**, and **ky** (HTTP client).

### Entry Points (`entrypoints/`)

- **`background.ts`** — Service worker. Registers context menus on install, handles menu clicks by calling the qui API, manages a 15-minute alarm-based cache refresh, and acts as the message passing hub.
- **`popup/`** — Toolbar popup. Shows favorites (starred instance/category pairs) and connection status.
- **`options/`** — Options page. Configures qui server URL, API key, host permissions, and favorites management.
- **`cross-seed/`** — Picker window opened by the "Cross-seed in qui" menu. Reads the pending payload from `chrome.storage.session`, lets the user pick the target torrent (ranked proposals, or a name search over the instance that pins any torrent through `pin-cross-seed-target`), category, and tags, then sends `apply-cross-seed` to the background.

### Shared Libraries (`lib/`)

- **`api.ts`** — ky-based HTTP client wrapping qui endpoints (`GET /api/instances`, `GET /api/instances/{id}/categories`, `POST /api/instances/{id}/torrents`, `POST /api/cross-seed/manual/proposals`, `POST /api/cross-seed/manual/apply`). Error responses surface qui's `error` text.
- **`cache.ts`** — Fetches and caches instances + categories to chrome.storage.local.
- **`menu-id.ts`** — Pure menu id helpers (`makeMenuId`, `makePathMenuId`, `makeCrossSeedMenuId`, `parseMenuId`). No wxt imports so tests can load it.
- **`menus.ts`** — Builds nested context menu structure from cached data (favorites appear first, save paths last). "Cross-seed in qui" lists every enabled instance and ignores `favoritesOnly`.
- **`messaging.ts`** — Typed message passing between background, popup, and options.
- **`storage.ts`** — Typed chrome.storage definitions: local (serverUrl, apiKey, favorites, savePaths, cachedData) and session (crossSeedPending, the torrent payload plus proposals for the open picker).
- **`permissions.ts`** — URL-to-origin conversion for host permission requests.

### Data Flow

1. Options page saves server URL + API key to chrome.storage
2. Background service worker caches instances/categories (refreshed every 15 min via alarm)
3. Cached data builds nested context menus: top-level per instance, sub-items per category
4. Menu click → `addTorrent(instanceId, url, category, { savePath })` → success/error notification

### Key Patterns

- **MV3 service worker**: No persistent state; all persistence via chrome.storage.local
- **Context menus registered in `onInstalled`**: Menus persist across service worker restarts
- **Menu item ID format**: `add|{instanceId}|{category}`, `path|{instanceId}|{savePath}`, or `cross-seed|{instanceId}|` (parsed on click, split on the first two `|` only)
- **Path alias**: `@/*` maps to project root in imports
- **CSS**: one plain stylesheet, `assets/app.css`, that imports Radix Themes and sets the color tokens as `:root` custom properties

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `s0up4200/qui-extension`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical labels, unchanged: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Release

Version bump, tag, store upload with `bun run submit`, the `.env.submit` layout, and store error meanings: see `docs/agents/release.md`.
