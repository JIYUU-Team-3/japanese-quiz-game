# Design

Recorded from the built implementation, not from intention. The direction contract lives in
[`src/app.html`](src/app.html) as the first child of `<body>` and ships in every HTML response.

## Visual world

**1980s Japanese game-center cabinet.** Pinned by the user over the rolled directions
(seed `a6e812cb`). This is not decoration on a quiz app: the product's own mechanics — three
lives, a score multiplier, a HI-SCORE table, and typing a name onto the board _after_ the run —
are arcade mechanics already, so the world describes the machine rather than dressing it.

Ruled out as hard boundaries: the cute/mascot language-app register, and traditional-Japan
imagery (brush, blossom, torii, washi, red disc).

Dark ground is forced by the material, not chosen as a mood: phosphor only emits where the beam
hits.

## Color

Strategy: **full palette, four named roles over a near-black tube.** Roles are borrowed from
the boards themselves and each one means exactly one thing.

| Token         | Value     | Role                                              |
| ------------- | --------- | ------------------------------------------------- |
| `--void`      | `#05060e` | the room behind the tube; page ground             |
| `--tube`      | `#0a0d1a` | screen ground                                     |
| `--tube-lift` | `#111629` | centre of the tube's radial lift                  |
| `--beam`      | `#f4f8ff` | phosphor white; question text and primary reading |
| `--gold`      | `#ffc400` | counts — score, HI-SCORE, credit, primary action  |
| `--red`       | `#ff3b14` | threatens — 1UP, lives, wrong answer, GAME OVER   |
| `--green`     | `#3be86b` | confirms — correct answer only                    |
| `--blue`      | `#2b5cff` | builds the field — borders, hover, structure      |
| `--dim`       | `#7f8bb8` | secondary text, tinted from the blue, never gray  |

`--dim` on `--tube` measures ≈4.7:1; `--red` ≈5.3:1; `--green` ≈11.7:1; `--gold` ≈12:1.
`--blue` is structure only and is never used for body text.

## Type

Two faces, split by role, because the machine and the language have different jobs.

- **`DotGothic16`** — all chrome: HUD, numerals, titles, labels, buttons, the character pad. A
  Japanese dot-matrix gothic with real kana and kanji coverage. This is the machine's voice.
- **`BIZ UDPGothic`** — question stems, answer options, glosses, instructional copy. A universal-
  design face built for legibility, used wherever a player must read Japanese fast under a clock.

The split is load-bearing, not stylistic: PRODUCT.md's accessibility clause requires kanji to stay
legible at speed, and a dot-matrix face cannot carry that at answer-option size.

Chrome copy is English (`SCORE`, `HI-SCORE`, `PUSH START`, `GAME OVER`, `CREDIT`). This is
historically correct — Japanese cabinets shipped English HUD text — and it resolves the tension in
PRODUCT.md's Japanese-first requirement, since the interface never outpaces the level being tested.

Fonts load from Google Fonts with `unicode-range` subsetting, which is the correct engineering
choice for CJK: self-hosting the full glyph sets would cost megabytes.

## Materials

- **Scanlines and vignette** ride above content on `.screen::after` at `mix-blend-mode: multiply`,
  never taking a pointer. 1px line on a 3px period, low opacity so text stays legible.
- **Phosphor bloom** is a zero-offset colored halo (`text-shadow: 0 0 12px`). Normally that is
  decoration; here it is the tube's actual behaviour and is used deliberately.
- **Bezel**: `.screen` carries a real offset shadow plus a deep inset, so the cabinet has depth
  even though the phosphor does not.
- All borders are `--rule` (2px). There is no rounding anywhere except the 6px bezel radius.

## Components

- Boot screen — the cabinet powering on. Covers everything on a cold load until the two typefaces
  and the landed screen's music track are ready, so the machine comes up once rather than swapping
  faces and stuttering its theme in front of the player. Deliberately drawn in the _system_
  monospace, never `DotGothic16`: it is on screen precisely because that face has not arrived, and
  dressing it in one would make it the first thing to reflow. Server-rendered, so it is in the HTML
  rather than mounted over a screen the player has already seen.
- `.cabinet` — the room. Radial lift over `--void`, centres the screen.
- `.screen` — the tube. Flex column, `min-height: min(760px, 100dvh - 56px)`, owns the scanlines.
- `.hud` / `.readable` — the two type roles.
- `.glow-*` — the four phosphor colours.
- HUD bar — persists in every phase of `/play` so the machine never loses its frame.
- Lives are authored inline SVG marks (3×3 grid), not glyphs or emoji.

## Motion

One authored moment per surface, not scattered effects.

- Boot: a gold bar ruled into lamps fills against real progress — the typefaces are worth 30% of
  it and the music track the rest, read from the element's own buffer — then the whole screen fades
  out over 420ms onto the cabinet behind it. Held for a minimum of 700ms so a warm reload reads as
  a machine starting rather than a flicker, and released after 8s regardless, because the game is
  completely playable in silence and a slow theme must never lock a player out of it.
- Attract: `PUSH START` blinks on a 1.06s step; the demo question cycles every 3.2s.
- Round: the timer bar is the motion — a `scaleX` transform driven by `requestAnimationFrame`,
  turning red under three seconds. Time is never the only channel: a numeric readout runs beside it.
- Members roll: the member contributions climb the tube, scrolled from `requestAnimationFrame` and
  timed so any line takes 20s to cross whatever the screen height, with an empty tube before and
  after so the loop joins without a visible jump. The player can scroll it by hand at any time; it
  holds for 2s after the last scroll and carries on from there. Only `← TITLE` stays pinned.
- Everything collapses under `prefers-reduced-motion: reduce`, including the demo cycle, which is
  cancelled at its source rather than merely hidden.

## Layout rules

- **Constant scale across all four answer cells.** No option may be visually favoured — a larger
  cell reads as the likelier answer and leaks a free hint. The choices grid uses equal `1fr` rows
  and identical styling; only state colour differentiates.
- **Nothing is labelled twice.** No element repeats what another already tells the player.
- **Every scrolling field centres with `justify-content: safe center`, never a bare `center`.** The
  tube is a fixed rectangle, so each phase's field (`.stage`, `.select`, `.over`) scrolls inside it
  — and a centred field that overruns is pushed past _both_ edges, where the overflow above the
  start edge can never be scrolled back to. That silently ate `GAME OVER` on an iPhone SE and the
  title lockup at 320px. `safe` centres while it fits and falls back to the top edge when it does
  not; a browser that does not know the keyword drops the declaration and lands on `flex-start`,
  which is the same escape.
- The round splits into a pinned HUD strip and a centred main block that fills the frame; the
  verdict area reserves its height so feedback never shifts the layout under a player's finger.
- Answer blanks (`＿＿＿`) are wrapped `white-space: nowrap` so they never break across lines.
- Two columns of options on desktop, one on mobile, at a 560px breakpoint.

## Browser surfaces

Themed from the palette rather than left at browser defaults: `::selection`, `caret-color`,
`accent-color`, scrollbar track and thumb, and `:focus-visible` (2px gold, 3px offset).
Numerals are `tabular-nums` everywhere a value changes.

## Known gaps

- No `prefers-contrast` handling.
- Time-based motion on a screen runs while the boot screen is still over it, so a player who deep-
  links to the members roll meets it a second or so in rather than at the top of the loop.
- The scanline overlay is a fixed opacity with no user control.
- The members roll has no dedicated pause control (WCAG 2.2.2). Scrolling by hand holds it for 2s,
  reduced motion stills it, and `← TITLE` is always reachable.
