---
name: SKILL//MIX
description: A loud, flat, printed-poster playground of short activities, one saturated colour field per activity.
colors:
  paper: "#f1eee6"
  ink: "#0d0d0d"
  acid: "#c8ff2e"
  bubble: "#ff8fd0"
  flare: "#ff5a1f"
  cobalt: "#2f3bff"
  muted: "#6b6a66"
typography:
  hero:
    fontFamily: "Archivo Variable, Pretendard Variable, system-ui, sans-serif"
    fontSize: "clamp(72px, min(16vw, 21dvh), 280px)"
    fontWeight: 850
    lineHeight: 0.86
    letterSpacing: "-0.01em"
    fontVariation: "font-stretch 70%"
  h1:
    fontFamily: "Archivo Variable, Pretendard Variable, system-ui, sans-serif"
    fontSize: "clamp(40px, 7vw, 96px)"
    fontWeight: 850
    lineHeight: 0.9
    letterSpacing: "-0.01em"
    fontVariation: "font-stretch 70%"
  h2:
    fontFamily: "Archivo Variable, Pretendard Variable, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 800
    lineHeight: 1
    fontVariation: "font-stretch 75%"
  body:
    fontFamily: "Pretendard Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(16px, 0.9vw + 10px, 18px)"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "JetBrains Mono, ui-monospace, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    letterSpacing: "0.08em"
  label-ko:
    fontFamily: "Pretendard Variable, system-ui, sans-serif"
    fontSize: "clamp(16px, 0.9vw + 10px, 18px)"
    fontWeight: 700
rounded:
  base: "2px"
  pill: "50%"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-5: "24px"
  s-6: "32px"
  s-7: "48px"
  s-8: "64px"
  s-9: "96px"
  s-10: "120px"
  gutter: "clamp(16px, 4vw, 48px)"
  touch: "44px"
components:
  button-primary:
    backgroundColor: "{colors.acid}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    padding: "0 24px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.acid}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    padding: "0 24px"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.base}"
    padding: "1px 8px"
  chip-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    padding: "24px"
  card-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  stat:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "16px 24px"
  ai-panel:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    padding: "32px"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    padding: "12px 24px"
  modal:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "32px"
  timer-bar-fill:
    backgroundColor: "{colors.ink}"
    height: "14px"
  timer-bar-fill-warn:
    backgroundColor: "{colors.flare}"
---

# Design System: SKILL//MIX

## Overview

**Creative North Star: "The Printed Poster Playground"**

SKILL//MIX reads as a flat, loud, screen-printed poster: warm paper ground, one near-black ink, and four saturated colour fields. Each activity owns exactly one of those fields (acid, bubble, flare, cobalt) and uses it as a whole surface, not as an accent. The type is compressed, heavy, uppercase Archivo set huge; everything else is plain and small so the display type and the colour blocks carry the page.

Depth does not exist. Hierarchy comes from scale, from 2px ink borders, and from full inversion (paper to ink) on hover, on selection, and for AI-produced regions. The one structural split in the system is provenance: app-measured numbers sit in paper boxes with solid 2px ink borders, and anything the AI wrote sits in an ink-inverted panel. A reader can tell measurement from interpretation by the box alone.

The build rejects the gradient-card AI-startup look and any game vocabulary (scores, levels, ranks) in wording and in form. Composition is a 12-column grid used asymmetrically: stacked hero lines indented by different amounts, steps staggered across columns, discover cards alternating 7 and 5 spans, and tags tilted off the grid.

**Key Characteristics:**
- Flat: no shadows, no gradients, no offset shadows anywhere in the build.
- Whole-field colour: the activity colour fills the card, the intro block, the countdown, never a thin stripe.
- 2px solid ink borders and 2px corners on every container.
- Inversion (paper to ink) is the single interaction and emphasis device.
- Compressed heavy caps for display, Pretendard for Korean and body, mono only for labels and measurements.
- Minimal motion: hero letter stagger, CSS hover and focus transitions, a countdown pop; final motion deferred.

## Colors

A restrained two-tone base (warm paper, hard ink) with four fully saturated activity fields that never appear together inside one component.

### Primary
- **Acid Lime** (`{colors.acid}`): the primary action fill (ENTER, primary buttons), QUICK THINK's activity field, switch-on track, empty-state icon box, text-selection highlight.

### Secondary
- **Bubble Pink** (`{colors.bubble}`): PATTERN FIND's activity field.
- **Flare Orange** (`{colors.flare}`): WORD WEAVE's activity field; also the timer warning state (timer bar fill and timer box) and the input caret.
- **Cobalt Blue** (`{colors.cobalt}`): SHAPE MIX's activity field. It cannot carry ink text (about 3:1), so on cobalt the on-accent text is paper.

### Neutral
- **Poster Paper** (`{colors.paper}`): page ground, header, tab bar, modal, stat boxes, timer boxes, play stage.
- **Press Ink** (`{colors.ink}`): all text, all borders, focus ring, AI panel and consent banner ground, hover-inverted fill, modal backdrop at 72% opacity.
- **Faded Ink** (`{colors.muted}`): disabled text and dashed borders, stat labels, the disclaimer footer. Used only for secondary text on paper.

### Named Rules
**The One Field Rule.** An activity's accent fills a whole surface (card, intro block, countdown, tag). It is never used as a thin underline, border-only accent, or text colour.

**The Paper-On-Cobalt Rule.** The `--on-accent` token pairs every accent with its legible text colour: ink on acid, bubble, flare; paper on cobalt. Read it, never hard-code ink on an accent.

**The Provenance Rule.** App-measured numbers go in paper boxes with a solid 2px ink border. AI-written content goes in ink-inverted regions. The two are never styled alike.

## Typography

**Display Font:** Archivo Variable (width axis, with Pretendard Variable and system-ui fallbacks), self-hosted via npm
**Body Font:** Pretendard Variable (with system-ui, -apple-system, Segoe UI fallbacks), self-hosted via npm
**Label/Mono Font:** JetBrains Mono 400 and 500 (with ui-monospace, Consolas), self-hosted via npm

**Character:** A squeezed, poster-weight grotesque (width axis 70-80%) against a quiet Korean-capable text face, with mono reserved for the small mechanical voice of labels and measurements.

### Hierarchy
- **Hero** (850, `clamp(72px, min(16vw, 21dvh), 280px)`, 0.86, width 70%, uppercase): the stacked three-line landing title only. The dvh term keeps the stack inside the first viewport.
- **Display / H1** (850, `clamp(40px, 7vw, 96px)`, 0.9, width 70%, uppercase): section titles and activity intro names. Discover card names run `clamp(40px, 6vw, 84px)`; preview names `clamp(36px, 4vw, 52px)`.
- **H2** (800, 40px, 1, width 75%, uppercase): sub-section titles.
- **Title** (850, `clamp(22px, 3vw, 32px)`, 1, width 75%, uppercase): in-play activity title. The logo is 900 at 26px, width 75%.
- **Body** (400, `clamp(16px, 0.9vw + 10px, 18px)`, 1.55, `word-break: keep-all`): all prose, 65ch measure via the prose class. Taglines run 500 weight at `clamp(18px, 2vw, 24px)`.
- **Label** (mono 400, 12px, 0.08em, uppercase): chips, small captions; nav links are mono 14px, tab bar 11px.
- **Label-ko** (Pretendard 700, body size, no tracking): Korean small labels, because the mono face has no Hangul.
- **Numerals**: stat values are Archivo 800, `clamp(32px, 5vw, 56px)`, tabular; the timer is mono 500 at `clamp(24px, 4vw, 36px)`, tabular. Always `tabular-nums` for measured digits.

### Named Rules
**The Mono Is Mechanical Rule.** JetBrains Mono appears only for labels, nav, the timer and measurements. Never for headings or body text, and never for Korean.

**The Squeezed Caps Rule.** Display roles are uppercase, compressed via `font-stretch` (70-80%), weight 800 or above. Do not substitute a system display face if the variable font fails to load.

## Layout

A 12-column grid (24px column gap) inside a `.page` container capped at 1600px with a fluid gutter of `clamp(16px, 4vw, 48px)`. Used asymmetrically: the hero title spans columns 1-9 with lines 2 and 3 indented by `clamp(24px, 9vw, 160px)` and `clamp(8px, 3vw, 56px)`, tilted tags sit in columns 10-12 on desktop and wrap below the title on mobile; steps alternate between columns 1-5, 7-11, 2-6, 8-12 with a 64px stagger; discover cards alternate 7/5/5/7 spans. Under 768px everything collapses to one column.

Spacing is a 4px-based scale (4, 8, 12, 16, 24, 32, 48, 64, 96, 120). Sections pad 64px vertically (120px from 768px). The landing first viewport is exactly 100dvh: a 72px top bar plus a hero filling the rest, tagline and primary button in a bordered foot row. Navigation is a sticky 64px paper header with a bottom border from 768px; below that a fixed 60px two-tab bar replaces it. Touch targets are at least 44px. Breakpoints in use: 480, 600, 768, 960, 1100px. The activity intro is a 7/5 split from 960px. Play screens pin a sticky paper footer with a top border for actions.

## Elevation & Depth

There is no elevation. The build contains no box-shadows, text-shadows, gradients, or blur. Depth is conveyed by 2px ink borders, hard paper/ink inversion, and one physical gesture: bordered tags tilt (4 to 9 degrees) and cards lift 4px and rotate -1deg on hover while inverting to ink.

### Named Rules
**The Flat Print Rule.** Surfaces never cast shadows. A thing stands out by border, by inversion, or by owning a colour field. If a design needs a shadow, it needs a border or a different field instead.

## Shapes

Square and printed. Every container, button, chip, input track, and card uses a 2px corner radius (`{rounded.base}`) with a 2px solid ink border. Circles (50%) appear only in the CSS-drawn activity illustrations (circle, dashed ring), and triangles via clip-path; there are no pills, no rounded cards. Disabled states switch the border to dashed and the fill to transparent. Illustrations and icons follow the text colour (`currentColor`) so they invert with hover. Icons come from Lucide only.

## Components

### Buttons
Heavy, uppercase, squarely bordered.
- **Shape:** 2px corners, 2px ink border, min height 44px (56px large, 22px type), padding 0 24px (0 32px large, 0 16px small at 15px).
- **Primary:** acid fill, ink text, Archivo 800 at 18px, width 80%, tracking 0.02em, uppercase.
- **Hover / Focus:** primary inverts to ink fill with acid text; ghost inverts to ink fill with paper text; 0.25s ease-out colour transition; `:active` nudges 1px down. Focus is a 3px ink outline offset 3px (paper on ink surfaces).
- **Ghost:** transparent fill, ink text and border. On ink surfaces it takes paper text and border.
- **Disabled:** transparent, muted text, dashed border, not-allowed cursor.

### Chips
- **Style:** mono 12px uppercase, 2px border in current colour, 2px radius, no fill; `chip--ink` is an ink fill with paper text.
- **State:** static labels (duration, activity metadata), not interactive filters.

### Cards / Containers
- **Corner Style:** 2px.
- **Background:** the activity accent (`--accent`) or paper; text via `--on-accent`.
- **Shadow Strategy:** none (see Elevation).
- **Border:** 2px solid ink.
- **Internal Padding:** 24px, with 16px vertical gap.
- **Behavior:** linked cards invert to ink/paper and lift with a -1deg tilt on hover and focus; their arrow slides 8px right. Disabled cards go transparent with a dashed border.

### Stat (app-measured numbers)
Paper box, 2px ink border, padding 16px 24px. Value in tabular Archivo, label in mono muted. The only place a measurement is displayed at size.

### AI Panel (ink-inverted)
Ink ground, paper text, 2px border, 32px padding. Carries every AI-authored statement. Notes inside run at 80% opacity, 14px. The consent banner on Discover uses the same ink treatment.

### Inputs / Fields
- **Style:** the segmented difficulty control is a 3-up grid in a 2px border with 2px dividers, mono 14px labels, 44px tall.
- **Focus:** the 3px outline on the labelled segment.
- **Selected:** ink fill with paper text; hover on unselected uses the activity accent. The switch is a 64x32 paper track with a square ink thumb; on state turns the track acid.

### Navigation
Logo is Archivo 900 at 26px. Desktop nav is mono 14px links with the current page marked by a 4px underline at 8px offset; mobile uses a fixed two-tab bar with mono 11px labels where the current tab inverts to ink. Landing top bar is wordmark left, ARCHIVE link and ENTER button right.

### Timer
A 14px paper bar with 2px border and an ink fill that scales from the left. The warning state turns the fill, and the numeric timer box, flare orange.

### Tilted Tags (signature)
Bordered activity-colour labels in Archivo 850, width 75%, uppercase, each rotated by its own angle (-8, 6, -4, 9 degrees on desktop) and absolutely scattered in the hero's right three columns. They preview the four colour fields.

### Toast and Modal
Toast: ink box with paper text and 2px border, floating above the mobile tab bar. Modal: paper, 2px border, max 480px, 32px padding, 72% ink backdrop.

## Do's and Don'ts

### Do:
- **Do** fill whole surfaces with one activity accent and take text from `--on-accent` (paper on cobalt, ink elsewhere).
- **Do** use 2px solid ink borders and 2px corners on every container and control.
- **Do** show app-measured numbers in paper boxes with a solid border and AI output in ink-inverted panels.
- **Do** inverse paper and ink for hover, selection, and the current tab.
- **Do** set measured numerals with `tabular-nums` and keep Korean text out of the mono face.
- **Do** keep touch targets at 44px minimum and focus outlines at 3px with a paper variant on ink.
- **Do** honour `prefers-reduced-motion` (transitions and animations drop to 0.01ms).

### Don't:
- **Don't** add shadows, offset shadows, gradients, glow, or blur.
- **Don't** use rounded cards or pill buttons; the radius is 2px.
- **Don't** use an accent as a thin stripe, underline, or text colour, or put ink text on cobalt.
- **Don't** use JetBrains Mono for headings, body, or Korean text.
- **Don't** style AI output like measured numbers or vice versa.
- **Don't** put score, level, rank, or grade language or visuals on any screen.
