# Changelog

## Unreleased

### Added
- Menu: send a torrent to a configured save path (#13). Set the paths in options, one per line. Each instance submenu lists them after the categories. Path items are hidden in favorites-only mode.

### Changed
- Permissions: drop the required `<all_urls>` host permission and the always-on content script (#3). Installation no longer warns about reading data on all websites.
- Torrent files: fetch `.torrent` links inside the clicked tab with `activeTab` and `scripting`. The context-menu click grants both.
- Server access: the qui server origin is now an optional host permission. Save in options requests it. Existing users see a **Grant access** button in options until they grant it. The popup and error notifications point to that button while it is missing.

### Removed
- Toolbar action enable/disable based on torrent links found on the page. The action is always enabled.

### Docs
- Add `docs/agents/` configuration for the engineering skills: GitHub issue tracker, default triage labels, and single-context domain docs.

## 0.3.1 — 2026-08-01

### Fixed
- Options: always show `(No category)` in the favorites list so it can be starred even when an instance has categories (#8).
- Torrent files: transfer fetched `.torrent` payloads as base64 again — Chrome JSON-serializes extension messages, so raw `ArrayBuffer`s arrived as empty objects and every file-based add failed with HTTP 500. The encode is chunked to avoid the Firefox lockups that prompted the raw-bytes change.
- Torrent files: stop converting fetched `.torrent` payloads to base64 before messaging; transfer raw bytes instead to reduce Firefox lockups on add.
- Torrent files: show a clear reload message when the content-script receiver is missing on the current tab.
- Options: keep save success separate from connection success, and show clearer setup errors for network, timeout, and auth failures.

## 0.3.0 — 2026-01-29

### Added
- Menu: allow selecting which instances appear in the context menu.
- Menu: skip instance selection when only one instance is enabled.
- Popup: hide instances that are disabled in menu settings.

### Changed
- Menu: show an empty-state when no instances are selected.
- Release: bump extension version to 0.3.0.

### Docs
- Add changelog.
- Require changelog updates in AGENTS.

## 0.2.1 — 2026-01-27

### Added
- Context menu: improved torrent link detection.
