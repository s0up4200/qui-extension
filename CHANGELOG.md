# Changelog

## Unreleased

### Fixed
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
