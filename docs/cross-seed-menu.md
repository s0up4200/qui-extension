# Cross-seed menu preference

The cross-seed action currently appears before the add actions. Users who do not use cross-seeding must pass it each time they add a torrent. A single preference lets users keep, move, or hide the action.

Add a "Cross-seed menu" setting with these choices:

- Top: Show the action before categories and saved paths. This is the default, including for existing users.
- Bottom: Show the action after categories and saved paths.
- Disabled: Remove the action from the menu.

Apply the preference to each enabled instance. Keep the existing category and saved path order. Show separators only between visible groups.

If an instance has no visible actions, hide its menu. If all enabled instances have no visible actions, show a disabled "No actions available (configure in settings)" item. Keep the existing messages for no available instances and no selected instances.

This covers the case where cross-seed is disabled, favorites only is enabled, and no favorites or saved paths are available.
