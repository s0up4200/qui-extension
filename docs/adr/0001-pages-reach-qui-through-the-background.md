# Pages reach qui only through the background

The popup, the options page, and the windows (cross-seed and "Other path…") send each qui call to the background as a background request. A background request is a message from a page that asks the background to do one job. No page imports a qui call from `lib/api.ts`, but a page can import its types. The direct call costs one less message hop. We chose one place for qui errors and one test surface for every qui call over that hop. Issue #56 moves the folder suggestions of the "Other path…" window to the background, because today that window still calls qui directly.

We add no lint guard for this rule. The repo has no linter, and a code review catches a direct import.
