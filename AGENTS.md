# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome extension (Manifest V3) that adds torrents to qBittorrent instances via a qui server. Right-click a magnet/torrent link, pick an instance and category from nested context menus, and receive a notification confirming the torrent was added.

## Commands

```bash
bun install             # Install dependencies
bun run dev             # Dev server with HMR (Chrome)
bun run dev:firefox     # Dev server (Firefox)
bun run build           # Production build (Chrome)
bun run build:firefox   # Production build (Firefox)
bun run zip             # Package for Chrome Web Store
bun run zip:firefox     # Package for Firefox
```

No test or lint commands are configured.

## Workflow

- Update CHANGELOG.md for every commit.

## Architecture

Built with **WXT** (Vite-based extension framework), **React 19**, **Tailwind CSS v4**, **Radix Themes**, and **ky** (HTTP client).

### Entry Points (`entrypoints/`)

- **`background.ts`** — Service worker. Registers context menus on install, handles menu clicks by calling the qui API, manages a 15-minute alarm-based cache refresh, and acts as the message passing hub.
- **`popup/`** — Toolbar popup. Shows favorites (starred instance/category pairs) and connection status.
- **`options/`** — Options page. Configures qui server URL, API key, host permissions, and favorites management.

### Shared Libraries (`lib/`)

- **`api.ts`** — ky-based HTTP client wrapping qui endpoints (`GET /api/instances`, `GET /api/instances/{id}/categories`, `POST /api/instances/{id}/torrents`).
- **`cache.ts`** — Fetches and caches instances + categories to chrome.storage.local.
- **`menus.ts`** — Builds nested context menu structure from cached data (favorites appear first).
- **`messaging.ts`** — Typed message passing between background, popup, and options.
- **`storage.ts`** — Typed chrome.storage.local definitions (serverUrl, apiKey, favorites, cachedData).
- **`permissions.ts`** — URL-to-origin conversion for host permission requests.

### Data Flow

1. Options page saves server URL + API key to chrome.storage
2. Background service worker caches instances/categories (refreshed every 15 min via alarm)
3. Cached data builds nested context menus: top-level per instance, sub-items per category
4. Menu click → `addTorrent(instanceId, url, category)` → success/error notification

### Key Patterns

- **MV3 service worker**: No persistent state; all persistence via chrome.storage.local
- **Context menus registered in `onInstalled`**: Menus persist across service worker restarts
- **Menu item ID format**: `add|{instanceId}|{category}` (parsed on click)
- **Path alias**: `@/*` maps to project root in imports
- **CSS**: Tailwind v4 CSS-first config with Radix Themes dark mode via `@layer`
