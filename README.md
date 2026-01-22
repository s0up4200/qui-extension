# qui

Chrome/Firefox extension for adding torrents to qBittorrent instances managed by [qui](https://github.com/soup/qui).

Right-click any magnet or torrent link, pick an instance and category, done.

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/EXTENSION_ID?label=Chrome)](https://chromewebstore.google.com/detail/EXTENSION_ID)
[![Firefox Add-ons](https://img.shields.io/amo/v/qui?label=Firefox)](https://addons.mozilla.org/en-US/firefox/addon/qui/)

## Install

**From stores** (once published): Use the badges above.

**Sideload from releases:** Download the latest zip from [Releases](https://github.com/soup/qui-chrome/releases), then:
- **Chrome:** `chrome://extensions` → Enable Developer mode → Drag zip or "Load unpacked"
- **Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → Select zip

## Setup

1. Install and configure a [qui](https://github.com/soup/qui) server
2. Open the extension options page
3. Enter your qui server URL and API key
4. Grant host permissions when prompted

## Development

```bash
bun install         # Install dependencies
bun run dev         # Dev server with HMR
bun run build       # Production build
bun run zip         # Package for Chrome Web Store
bun run zip:firefox # Package for Firefox
```
