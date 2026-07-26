# Design System

## Stack

- Runtime: Node.js 20+ ESM
- Surface: Waybar custom module and Walker dmenu prompts
- Styling: Waybar GTK CSS inherited from the user's active theme
- Icons: TickTick's brand mark from the pinned CC0 Simple Icons font
- Motion: Walker and Waybar native transitions only

## Tokens

- Foreground: inherited from `@foreground`
- Accent: inherited from `@accent`
- Error: inherited from `@error`, with `@foreground` fallback
- Spacing: align with adjacent Waybar modules
- Radius and surface: owned by the user's Waybar theme

## Information hierarchy

1. The number of actionable tasks due today or overdue
2. Overdue state
3. Task titles in the tooltip
4. Quick add and completion actions
5. Full TickTick as an advanced fallback

## Interaction contract

- Left-click: searchable task completion menu
- Right-click: one-line Inbox capture
- Middle-click: TickTick Today in the browser
- Hover: at most eight task titles, grouped by overdue and today
- Escape or blank input: cancel without side effects
- Successful mutations: notify and refresh immediately
- Offline failures: preserve and visibly mark stale data
- Authentication failures: show an actionable locked state without exposing credentials

## Components

- Waybar status module (`src/domain.mjs`, `src/cli.mjs`): icon, actionable count,
  semantic state and tooltip
- Walker completion menu (`src/desktop.mjs`, `src/service.mjs`): add action, due
  tasks and all-open fallback
- Walker quick-add prompt (`src/desktop.mjs`, `src/service.mjs`): one-line Inbox
  capture
- Desktop notification (`src/desktop.mjs`): success or failure confirmation

## States

- Default: icon and non-zero count
- Clear: icon only
- Overdue: semantic alert colour
- Stale: reduced opacity while retaining cached content
- Locked: authentication guidance
- Error: actionable failure with no cached content
- Loading: the last good state remains visible; no skeleton is appropriate in a 28px status bar
- Disabled: not applicable because Waybar custom modules do not expose a disabled interaction state

## Decisions

- 2026-07-26: Use Walker rather than a custom GTK popup to minimise dependencies and focus bugs.
- 2026-07-26: Inherit the active Waybar theme; do not hard-code a separate visual identity.
- 2026-07-26: Keep destructive scope narrow. Completing a selected task is deliberate; deleting and editing are outside v1.
- 2026-07-26: Do not add Hyprland keybindings automatically.
- 2026-07-26: Use theme-owned foreground plus weight, surface contrast and
  opacity for state styling, avoiding colours that break custom Waybar themes.
- 2026-07-26: Tighten the official CLI's credential directory and file to
  `0700` and `0600` after OAuth.
- 2026-07-26: Keep the existing centre widgets in one inherited-theme pill and
  render TickTick as a separate adjacent pill.
- 2026-07-26: Use the actual TickTick mark from Simple Icons rather than a
  generic checkmark.
- 2026-07-26: Render the Simple Icons glyph at 90% with a half-point optical
  rise so its circle aligns with the adjacent count at Waybar's 12px text size.
- 2026-07-26: Open Walker from cached task data and invoke its dmenu mode
  directly. Network refreshes must not block an interface from appearing.
- 2026-07-26: Invalidate successful mutations by expiring the cached snapshot
  rather than deleting it, preserving an instant stale-while-refreshing menu.

## Non-goals

- No task editor, postponing, deletion, habits or recurrence authoring
- No natural-language date parser
- No custom daemon
- No app-specific visual theme
