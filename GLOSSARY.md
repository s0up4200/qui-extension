# qui extension

A browser extension that sends torrent links to qBittorrent instances through a qui server.

## Language

**Save path**:
A folder on the qBittorrent host where the files of a torrent go.
_Avoid_: Download folder, location

**Saved path**:
A save path that the user lists in options and that shows in the menu.
_Avoid_: Path preset, favorite path

**Background request**:
A message from a page of the extension that asks the background to do one job.
_Avoid_: API message, message type

**One-time path**:
A save path that the user types in the "Other path…" window for one torrent, and that the extension does not keep.
_Avoid_: Custom path, manual path
