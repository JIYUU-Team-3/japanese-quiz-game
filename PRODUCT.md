# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

JLPT **N3 and N4 learners** — intermediate students who already read kana fluently and are
working on vocabulary and grammar at those two levels. They pick their level explicitly at the
start; the app does not place them.

They arrive without an account and play a short, timed run. Identity is claimed only at the end,
by typing a name onto a score. There is no returning-user profile, no login, and no saved
history tied to a person.

Confirmed non-audiences: absolute beginners drilling kana, and learners working on kanji stroke
detail or listening comprehension. Those are out of scope for the content, not merely
unprioritized.

## Product Purpose

A timed arcade-style quiz over JLPT N3 and N4 vocabulary and grammar.

The loop is: choose level → answer four-option questions against a clock while a score and streak
build → the run ends → enter a name → the score lands on a leaderboard. A credits page names the
team.

Success is a learner immediately starting another run, and a leaderboard that a group competes
on. It is not measured by long-term retention, study streaks, or scheduled review.

## Positioning

Most JLPT study tools are flashcard decks with spaced repetition, accounts, and progress
dashboards — optimized for retention over weeks. This is a **score-attack game**: the clock and
the leaderboard are the point, and the study benefit is a consequence of wanting a better score.

Two facts a neighboring product could not truthfully copy without becoming this one:

- **Identity is claimed after the run, not before it.** Nothing stands between arriving and the
  first question — no sign-up, no email, no profile. The name matters only because a score
  earned it. This is the arcade cabinet pattern, and it is deliberate.
- **Grammar sits alongside vocabulary in the same timed run.** Grammar is usually taught in
  untimed, explanatory formats. Putting N3/N4 grammar under a clock, in the same rhythm as
  vocabulary, is the distinguishing content decision.

## Operating Context

- Runs are short and self-contained. A session is one or more discrete attempts, not an
  open-ended study period that can be paused and resumed.
- The web app is deployed to Cloudflare Workers; the leaderboard is the only durable state.
- Built by **JIYUU-Team-3** as team work; repository is `JIYUU-Team-3/japanese-quiz-game`.
- Because scores are public on a shared leaderboard, the name-entry moment is social — it is read
  by other players, not stored privately.

## Capabilities and Constraints

### Confirmed product facts

- **Level selection**: N3 and N4, chosen by the learner before a run.
- **Content scope**: vocabulary **and** grammar. Not kana recognition, not kanji readings as a
  distinct exercise, not audio or listening prompts.
- **Answer input**: multiple choice, four options, one tap. No typed input, no Japanese IME
  requirement anywhere in the game loop.
- **Timed rounds** with a live **score** and **streak**.
- **End-of-run name entry**: the learner types a name to attach to their score.
- **Leaderboard** of submitted scores.
- **Credits page** naming the team.
- **Japanese-first interface.** UI chrome is in Japanese, not only the question content.
- **No authentication and no user accounts.** A name is a string on a score row, not an identity
  the system recognizes across runs.

### Technical constraints (already fixed by the codebase)

- SvelteKit (`next`) with Svelte 5, **runes forced on** for all non-`node_modules` files; config
  lives inline in `vite.config.ts` with no `svelte.config.js`. Experimental `async` and
  `remoteFunctions` are enabled.
- Cloudflare Workers edge runtime via `@sveltejs/adapter-cloudflare`. Only `nodejs_als` is
  enabled — no broad Node API surface.
- Cloudflare **D1 database `quizdb`** is provisioned and bound (`wrangler.jsonc`), accessed
  through Drizzle ORM.
- Paraglide JS for i18n, `en` as base locale plus `ja`.
- pnpm; Vitest (browser + node projects) for unit/component tests; Playwright for E2E.

### Current state the work must account for

- `src/lib/server/db/schema.ts` defines a placeholder `task` table from the Drizzle starter, not
  quiz data. `getDb()` is exported but never called by any route. No migrations are committed.
- `src/routes/demo/` and `src/lib/vitest-examples/` are generated template scaffolding.
- `tests/example.spec.ts` tests `playwright.dev`, not this app. CI runs Playwright only.
- No stylesheet, design tokens, fonts, or components exist yet. The app is unstyled scaffolding.

### Explicitly undecided

These are open decisions, not omissions. Future work must not silently settle them.

- **Where questions come from.** No question bank has been chosen — not authored, not sourced
  from a public JLPT dataset. The schema must accept any of those origins.
- Round length: timer duration and number of questions per run.
- Whether the leaderboard is global or scoped per level (N3 and N4 ranked separately).
- How the timer behaves — one clock for the whole run, or per question.
- What happens on a wrong answer: whether the run continues, loses time, or ends.
- Product name. `japanese-quiz-game` is the repository name and has not been confirmed as the
  name shown to players.

## Brand Commitments

- Team name **JIYUU-Team-3** is factual and appears in the credits page.
- **Pinned visual world: 1980s Japanese arcade game.** The user chose this directly over the
  rolled directions. Binding.
- **Ruled out as hard boundaries:** anything cute or mascot-driven (the language-app register),
  and traditional-Japan imagery (brush calligraphy, cherry blossom, torii, washi, the red disc).
- No logo, wordmark, or voice has been established beyond the above. The favicon at
  `src/lib/assets/favicon.svg` is the stock SvelteKit mark and carries no brand commitment.

## Evidence on Hand

- **No question content exists.** There is no vocabulary list, no grammar bank, no sample items.
  Future work must not present invented JLPT questions as authoritative content; any placeholder
  must be visibly labeled as such and must not ship as real study material.
- **No scores, no players, no leaderboard data.** Every leaderboard state must be designed from
  empty first.
- No brand assets, imagery, screenshots, testimonials, user research, or usage data.
- The D1 database exists and is bound but holds no quiz data.

## Product Principles

1. **The clock is the product.** Every screen exists to get a learner into a run, keep them in
   it, or send them back into another one. Anything that does none of those is a candidate
   for deletion.
2. **Nothing gates the first question.** Identity is earned at the end of a run, never demanded
   at the start. No sign-up, no setup, no configuration before play.
3. **The interface must never be harder than the questions.** A Japanese-first UI aimed at N4
   learners only works if its chrome stays at or below the level being tested. If a player has to
   decode a button, the interface has failed at its own game.
4. **Level is a promise.** N3 and N4 must stay honestly separate. A player who chooses N4 and
   meets N3 material loses trust in the score they just earned.
5. **Excellent with a small bank.** The question set will start tiny and grow by hand. The
   experience must feel complete at a few dozen questions, not only at a few thousand.

## Accessibility & Inclusion

No formal conformance standard has been established for this project. The product-specific needs
that are already known:

- **Japanese text must stay legible at small sizes and under time pressure.** Kanji lose
  distinguishing detail when set small; the reading conditions here are worse than normal
  prose because a player is scanning fast against a clock.
- **The timer cannot be the only channel for urgency.** Time remaining must be perceivable
  without relying on color alone or on motion alone.
- **Four-option tap targets must be comfortably hittable on a phone under time pressure**, where
  a mis-tap costs a real score.
- The interface being in Japanese is a deliberate constraint on the audience, and Principle 3
  above is the mitigation.
