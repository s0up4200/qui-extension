# Changelog

## Unreleased

### Changed
- Release: `bun run submit` builds the zips and uploads them to the Chrome Web Store and Firefox Add-ons through `wxt submit`. Store credentials live in `.env.submit`, which git ignores. Run `bunx wxt submit init` once to create it.

### Fixed
- CI: the release job downloads the build artifact into `extensions/` again, so tagged builds attach the zips to the GitHub release.

## 0.4.0 — 2026-09-03

### Added
- Menu: send a torrent to a configured save path (#13). Set the paths in options, one per line. Each instance submenu lists them after the categories. Path items show in favorites-only mode too.
- Cross-seed: a **Cross-seed in qui** context-menu item for `.torrent` links (#11). It lists every enabled instance and opens a picker window with the torrents qui ranks by file overlap. Pick a target from the ranked list or search the instance by name for any other torrent, set category and tags, and qui adds the torrent pinned to that target with a full recheck. Needs qui 1.28.0 or newer. Magnet links are rejected because they carry no file list.

### Changed
- Dependencies: ky 2, TypeScript 7, wxt 0.21, lucide-react 1, and the rest of the dependabot group (#21). The ky client uses the new `prefix` option and hook state objects. `tsconfig.json` drops `baseUrl`, which TypeScript 7 rejects.
- CI: a `bun run typecheck` step runs `tsc --noEmit` after the tests, so a dependency bump that breaks types fails the build. The test files get `@types/bun`.
- CI: the Claude review job reviews the whole PR when it opens and only the new commits on later pushes.
- CI: the Claude review workflow uses Opus 5 with a 100-turn limit and runs only on PRs from the repository owner.
- CI: the Claude review workflow can post its review comment. It ran on every PR but was denied write access and the `gh pr comment` tool, so it never posted.
- CI runs `bun test` before the build. Dependabot checks GitHub Actions and bun dependencies weekly.
- Errors: notifications and the options page now show the error text qui returns instead of only the HTTP status.
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
