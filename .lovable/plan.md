# First-visit guided tour

A one-time, skippable walkthrough that orients a brand-new marketing manager on what this app *is* and where the first 30 seconds of value lives. Triggers automatically on first dashboard load after signup; replayable from the Setup pill menu.

## Trigger logic

- Show when `profiles.onboarded_at IS NULL` AND `user_preferences[tour_v1]` does not contain `"completed"` or `"skipped"`.
- Auto-start on `/dashboard` mount, 600ms after first paint (lets hero + checklist animate in).
- "Take the tour" link added to the Setup pill expanded view → replays at any time.
- Press `Esc` or click backdrop → marks `skipped`. "Finish" on last step → marks `completed` AND sets `profiles.onboarded_at = now()`.
- Respects `prefers-reduced-motion` (no spotlight pulse, instant step transitions).

## The 6 steps

Each step: highlighted target element + glass tooltip card with eyebrow, 1-line title, 2-line body, Back/Next/Skip controls, step counter `2 of 6`.

1. **Welcome** (centered modal, no target) — "Welcome to Campaign Canvas. 60-second tour?" CTAs: `Take the tour` / `Skip — I'll explore`.
2. **Hero headline** (`/dashboard`, target = welcome `<h1>`) — "This is your command center. Every campaign, channel, and KPI lives here."
3. **Onboarding checklist** (target = `OnboardingChecklist` panel or Setup pill) — "Five 30-second wins to get value today. Knock them off in any order."
4. **Tools hex grid** (navigate to `/tools`, target = `HexToolsTree` stage) — "Your toolbelt. Click any hex to launch a focused tool — UTMs, audiences, AI campaign briefs."
5. **Campaigns hub** (navigate to `/campaigns`, target = "New campaign" button) — "Every artifact lands on a campaign. Start one here — or let Campaign-in-a-Box draft it for you."
6. **Done** (centered modal, confetti reuses checklist-complete burst) — "You're set. The Setup pill keeps you on track." CTA: `Start exploring` → returns to `/dashboard`.

## Visual + interaction design

- **Spotlight**: full-screen `position: fixed` overlay at `z-9000`. Backdrop is `oklch(0.06 0.02 270 / 0.78)` with `backdrop-blur-sm`. Target hole cut via a 4-rect mask (top/right/bottom/left of target bbox) — no SVG, no clip-path complexity. 12px padding around target, 16px border-radius hole.
- **Spotlight border**: 2px primary ring on the hole + soft `box-shadow: 0 0 60px oklch(0.78 0.18 275 / 0.5)`. Reduced-motion: static.
- **Tooltip card**: `GlassPanel tier="strong"` glow, 320px wide, auto-positioned (prefers below target, falls back above/centered). Arrow points to target.
- **Motion**: framer-motion fade + 6px y-translate per step transition, 240ms ease-out. Spotlight rect animates via `useSpring` on x/y/w/h so it slides between targets instead of jump-cutting.
- **Keyboard**: `Esc` skips, `←/→` Back/Next, `Enter` advances.

## Persistence

- `user_preferences` row with `key = "tour_v1"`, `values` array containing one of `"completed" | "skipped"` (reuses the existing checklist pattern — no migration).
- `profiles.onboarded_at` is set on completion (column already exists).

## Files

```text
src/components/tour/
  GuidedTour.tsx           // controller: state machine, persistence, keyboard
  TourSpotlight.tsx        // animated mask overlay + tooltip positioning
  tour-steps.ts            // step definitions (id, target selector, route, copy)
src/hooks/
  use-tour.ts              // open/close/replay API + persisted state
src/routes/_app.tsx        // mount <GuidedTour /> once inside the shell
src/components/app/OnboardingChecklist.tsx  // add "Replay tour" link
```

## Targeting strategy

- Each tour step declares a CSS selector OR `data-tour="step-id"` attribute.
- Add `data-tour` to: dashboard `<h1>`, checklist panel, hex tree `.mp-htt-stage`, campaigns "New campaign" button.
- Controller waits up to 1.5s for selector to mount (per-step navigate → poll for element) before falling back to centered modal copy with a "Got it" button.

## Edge cases

- User refreshes mid-tour → resume from `user_preferences[tour_v1].step` (extends values shape to `["in_progress", step_id]`).
- Mobile (<768px): tour still runs; tooltip becomes a bottom sheet, spotlight padding shrinks to 6px.
- If user navigates manually mid-tour, abort gracefully and keep `in_progress` so they can resume from the Setup pill.

## Out of scope (for this pass)

- A/B tour copy.
- Per-role tours (admin vs member).
- Branching ("are you here for X or Y?") — single linear path.
- Video/screencast embeds.
