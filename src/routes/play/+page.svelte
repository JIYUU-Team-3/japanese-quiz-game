<script lang="ts">
	import { onDestroy } from 'svelte'
	import { resolve } from '$app/paths'
	import { invalidateAll } from '$app/navigation'
	import { activeRunState, resetActiveRun, QUESTION_MS, START_LIVES } from '#lib/game/run.svelte.js'
	import { ApiError, fetchQuestions, placementFor, submitSession } from '#lib/game/api.js'
	import { MISS_CUE_MS, play, unlockAudio } from '#lib/game/sound.svelte.js'
	import { NAME_CHARS, NAME_MAX, PLAYABLE_LEVELS, type JlptLevel } from '#lib/game/types.js'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	const run = activeRunState.run
	const LIFE_SLOTS = Array.from({ length: START_LIVES }, (_unused, i) => i)

	/**
	 * How long the ✕ is up: one stamp, held through the buzzer's decay and gone
	 * on the frame it goes quiet. Owned by `#lib/game/sound.svelte.js`, because
	 * the buzzer is a recording now and only the file knows how long it rings.
	 * The `miss-stamp` keyframes in the stylesheet are the same span.
	 */
	const MISS_MS = MISS_CUE_MS

	/**
	 * A token for the ✕ currently on screen, or null. A counter rather than a
	 * boolean so that keying on it restarts the stamp cleanly if two misses ever
	 * land inside one cue. Decorative: never announced — the verdict line
	 * already says ざんねん or TIME UP.
	 */
	let miss = $state<number | null>(null)
	let missTimer: ReturnType<typeof setTimeout> | undefined
	let misses = 0
	// Held outside the reactive graph on purpose: these are the previous frame's
	// values, which are the one thing a rune must not re-read. Seeded off the run
	// and not off a constant, because `activeRunState.run` outlives this screen:
	// coming back from REVIEW mid-run must not replay a verdict already heard.
	let prevAsked = run.asked
	let prevPhase = run.phase

	// The verdict, in sound. `asked` is the one counter that ticks for both ways
	// a question can end — a pick and a timeout — so watching it covers both
	// where watching `lives` would miss every correct answer. The miss cue
	// outlives the feedback pause (NEXT arms at 350ms), so the ✕ is timed off the
	// miss itself and not off the phase it happened in. That timer is also what
	// clears the ✕ under reduced motion, where the stamp that would otherwise end
	// it is collapsed away.
	$effect(() => {
		const done = run.asked
		const live = run.phase === 'asking' || run.phase === 'feedback'
		// Not `>`: CONTINUE? starts a fresh run and `asked` drops back to zero, so
		// a rising edge would swallow the first verdict of every run after the
		// first. Any change to a non-zero count is a question that just ended.
		//
		// The phase guard is what keeps a remount quiet: the run is shared state,
		// so arriving back from REVIEW re-runs this against a run that has already
		// been played. Only a live question can have just ended.
		if (live && done !== prevAsked && done > 0) {
			if (run.lastCorrect) {
				play('correct')
			} else {
				miss = ++misses
				// Same frame as the ✕ mounts. Both clocks start here and neither
				// waits on JavaScript again, which is why they stay together.
				play('miss')
				clearTimeout(missTimer)
				missTimer = setTimeout(() => (miss = null), MISS_MS)
			}
		}
		prevAsked = done
	})

	// GAME OVER gets its own cue. The music coming back up under it is the
	// layout's doing, not this screen's — it owns the music level for every
	// route, and reads the run's phase to know this one.
	$effect(() => {
		const phase = run.phase
		if (phase === 'over' && prevPhase !== 'over') play('over')
		prevPhase = phase
	})

	const table = $derived(activeRunState.posted ?? data.table)
	let sending = $state(false)
	let loadError = $state<string | null>(null)
	let submitError = $state<string | null>(null)

	const hiScore = $derived(table[0]?.score ?? 0)
	const seconds = $derived(Math.ceil(run.remaining / 1000))
	const canSubmit = $derived(
		activeRunState.name.trim().length > 0 && !sending && activeRunState.recorded === null,
	)

	// A prediction, so GAME OVER can raise the name pad without waiting on the
	// network. The rank finally shown is the one the server sends back.
	const placement = $derived(run.phase === 'over' ? placementFor(run.score, table) : null)

	onDestroy(() => {
		run.stop()
		clearTimeout(missTimer)
	})

	async function begin(level: JlptLevel) {
		// The one gesture every run is guaranteed to have. A life can be lost with
		// no gesture near it — the clock running out is the machine acting, not the
		// player — so the hardware is opened here and is still open when it is.
		unlockAudio()
		play('start')
		clearTimeout(missTimer)
		miss = null
		activeRunState.recorded = null
		activeRunState.name = ''
		loadError = null
		submitError = null
		run.loading(level)

		try {
			const questions = await fetchQuestions(level)
			if (questions.length === 0) {
				loadError = `${level} HAS NO QUESTIONS YET`
				resetActiveRun()
				return
			}
			run.start(level, questions)
		} catch (cause) {
			loadError = cause instanceof ApiError ? cause.message : 'COULD NOT LOAD QUESTIONS'
			resetActiveRun()
		}
	}

	function pushChar(char: string) {
		if (activeRunState.name.length < NAME_MAX) activeRunState.name += char
	}

	function backspace() {
		activeRunState.name = activeRunState.name.slice(0, -1)
	}

	/**
	 * Posts the run and shows what was recorded.
	 *
	 * The score sent up is not a number — it is the answer log. The server
	 * regrades it, and the figure that comes back is what lands on the board, so
	 * this is the point where the run stops being the browser's opinion.
	 */
	async function finish() {
		if (!canSubmit) return
		sending = true
		submitError = null
		try {
			const response = await submitSession(run.toSubmission(activeRunState.name))
			activeRunState.recorded = response.recorded
			activeRunState.posted = response.table
			// The attract screen and /ranking read the same board; drop their
			// server-loaded copies so neither shows the table without this run.
			void invalidateAll()
		} catch (cause) {
			submitError = cause instanceof ApiError ? cause.message : 'COULD NOT RECORD THE RUN'
		} finally {
			sending = false
		}
	}

	function ordinal(n: number): string {
		const rem100 = n % 100
		if (rem100 >= 11 && rem100 <= 13) return 'TH'
		return ['TH', 'ST', 'ND', 'RD'][n % 10] ?? 'TH'
	}

	function onKey(event: KeyboardEvent) {
		if (run.phase === 'feedback') {
			if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowRight') {
				event.preventDefault()
				run.next()
			}
			return
		}
		if (run.phase !== 'asking' || !run.current) return
		const key = event.key.toUpperCase()
		const letter = 'ABCD'.indexOf(key)
		const digit = '1234'.indexOf(key)
		const index = letter >= 0 ? letter : digit
		if (index >= 0 && index < run.current.choices.length) {
			event.preventDefault()
			run.answer(index)
		}
	}
</script>

<!-- The life mark: a 3×3 dot-matrix cross, authored as geometry so it carries
     the tube's bloom the way a glyph or an emoji never could. -->
{#snippet lifeMark(state: '' | 'spent')}
	<svg class="mark {state}" viewBox="0 0 3 3" aria-hidden="true">
		<rect x="1" y="0" width="1" height="1" />
		<rect x="0" y="1" width="3" height="1" />
		<rect x="1" y="2" width="1" height="1" />
	</svg>
{/snippet}

<!-- The batsu: a 7×7 dot-matrix ✕, authored as geometry like the life mark so
     it takes the tube's bloom and scanlines. Strokes two cells thick, because a
     one-cell diagonal at this resolution reads as a staircase and not a mark. -->
{#snippet batsu()}
	<svg class="batsu" viewBox="0 0 7 7" aria-hidden="true">
		<rect x="0" y="0" width="2" height="1" /><rect x="5" y="0" width="2" height="1" />
		<rect x="0" y="1" width="3" height="1" /><rect x="4" y="1" width="3" height="1" />
		<rect x="1" y="2" width="5" height="1" />
		<rect x="2" y="3" width="3" height="1" />
		<rect x="1" y="4" width="5" height="1" />
		<rect x="0" y="5" width="3" height="1" /><rect x="4" y="5" width="3" height="1" />
		<rect x="0" y="6" width="2" height="1" /><rect x="5" y="6" width="2" height="1" />
	</svg>
{/snippet}

<svelte:head><title>PLAY — 日本語アタック</title></svelte:head>
<svelte:window onkeydown={onKey} />

<div class="cabinet">
	<main class="screen play">
		<!-- A miss, stamped where the player is looking: centre-tube, over the
		     round, under the scanlines. Takes no layout and no pointer, so the
		     verdict underneath never moves and NEXT stays hittable through it. -->
		{#if miss !== null}
			{#key miss}
				<div class="miss" aria-hidden="true">
					<span class="miss-pop">{@render batsu()}</span>
				</div>
			{/key}
		{/if}

		<!-- HUD is present in every phase so the machine never loses its frame. -->
		<header class="hud-bar hud">
			<span class="slot">
				<b class="glow-red">1UP</b>
				<span class="glow-gold num">{run.score.toLocaleString()}</span>
			</span>
			<span class="slot">
				<b class="glow-beam">HI-SCORE</b>
				<span class="glow-gold num">{Math.max(hiScore, run.score).toLocaleString()}</span>
			</span>
			<span class="slot lives" aria-label="{run.lives} of {START_LIVES} lives remaining">
				<b class="glow-beam">REST</b>
				<span class="marks">
					<!-- The counter tells the truth on the same frame the life is gone.
					     The burn-out is not here; it is centre-tube, where the eye is. -->
					{#each LIFE_SLOTS as i (i)}
						{@render lifeMark(i >= run.lives ? 'spent' : '')}
					{/each}
				</span>
			</span>
			{#if run.phase !== 'select' && run.phase !== 'loading'}
				<span class="slot">
					<b class="glow-beam">RATE</b>
					<span class="num glow-beam">×{run.multiplier}</span>
				</span>
			{/if}
		</header>

		{#if run.phase === 'select' || run.phase === 'loading'}
			<section class="select">
				<h1 class="select-head hud glow-gold">SELECT COURSE</h1>
				<p class="select-sub readable">コースを選んでください</p>
				<div class="courses">
					{#each PLAYABLE_LEVELS as level (level)}
						{@const stocked = (data.counts[level] ?? 0) > 0}
						<button
							class="course"
							disabled={run.phase === 'loading' || !stocked}
							onclick={() => begin(level)}
						>
							<span class="course-lv hud glow-gold">{level}</span>
							<span class="course-ja readable">{level === 'N4' ? '初級' : '中級'}</span>
							<span class="course-meta hud">
								{#if run.phase === 'loading' && run.level === level}
									LOADING…
								{:else if stocked}
									{data.counts[level]} QUESTIONS
								{:else}
									OUT OF SERVICE
								{/if}
							</span>
						</button>
					{/each}
				</div>
				{#if loadError}
					<p class="load-error hud glow-red">{loadError}</p>
				{/if}
				<p class="select-rule readable">
					語彙と文法の４択。１問{QUESTION_MS / 1000}秒。ミス{START_LIVES}回でゲームオーバー。
				</p>
				<a class="back hud" href={resolve('/')}>← TITLE</a>
			</section>
		{:else if run.current && (run.phase === 'asking' || run.phase === 'feedback')}
			{@const q = run.current}
			{@const parts = q.source.prompt.split('＿＿＿')}
			<section class="round">
				<div class="round-top">
					<div class="timer" class:critical={run.critical} aria-hidden="true">
						<div class="timer-fill" style="transform: scaleX({run.timeFraction})"></div>
					</div>
					<p class="timer-read hud" class:critical={run.critical}>
						<span class="glow-beam">TIME</span>
						<span class="num">{run.phase === 'feedback' ? '—' : seconds}</span>
					</p>

					<p class="tag hud">
						<span class="glow-beam">{run.level}</span>
						<span class="dot">·</span>
						<span class="glow-beam">{q.source.topic.nameJa}</span>
						<span class="dot">·</span>
						<span class="glow-beam">Q{run.asked + (run.phase === 'feedback' ? 0 : 1)}</span>
					</p>
				</div>

				<div class="round-main">
					<h1 class="prompt readable">
						{#each parts as part, i (i)}{part}{#if i < parts.length - 1}<span class="blank"
									>＿＿＿</span
								>{/if}{/each}
					</h1>

					<ul class="choices">
						{#each q.choices as choice, i (choice.id)}
							{@const isAnswer = i === q.answer}
							{@const isPicked = run.picked === i}
							<li>
								<button
									class="choice readable"
									class:correct={run.phase === 'feedback' && isAnswer}
									class:wrong={run.phase === 'feedback' && isPicked && !isAnswer}
									disabled={run.phase === 'feedback'}
									onclick={() => run.answer(i)}
								>
									<span class="key hud">{'ABCD'[i] ?? i + 1}</span>
									<span class="text">{choice.body}</span>
								</button>
							</li>
						{/each}
					</ul>

					<div class="verdict" aria-live="polite">
						{#if run.phase === 'feedback'}
							<div class="verdict-row">
								<div class="verdict-text">
									<p class="verdict-line hud" class:ok={run.lastCorrect}>
										{#if run.lastCorrect}
											<span class="glow-green">せいかい！</span>
											<span class="glow-gold num">+{run.lastGain.toLocaleString()}</span>
										{:else if run.timedOut}
											<span class="glow-red">TIME UP</span>
										{:else}
											<span class="glow-red">ざんねん</span>
										{/if}
									</p>
									{#if q.source.explanation}
										<p class="verdict-gloss readable">{q.source.explanation}</p>
									{/if}
								</div>
								<button
									class="next hud"
									class:final={run.finalAnswer}
									disabled={!run.canAdvance}
									onclick={() => run.next()}
								>
									{run.finalAnswer ? 'RESULT' : 'NEXT'} <span class="arrow">▶</span>
								</button>
							</div>
						{/if}
					</div>
				</div>
			</section>
		{:else}
			<section class="over">
				<h1 class="over-head hud glow-red">GAME OVER</h1>

				<dl class="tally hud">
					<div>
						<dt>SCORE</dt>
						<dd class="glow-gold num">{run.score.toLocaleString()}</dd>
					</div>
					<div>
						<dt>SOLVED</dt>
						<dd class="num">{run.solved}</dd>
					</div>
					<div>
						<dt>BEST STREAK</dt>
						<dd class="num">{run.bestStreak}</dd>
					</div>
					<div>
						<dt>COURSE</dt>
						<dd>{run.level ?? '—'}</dd>
					</div>
				</dl>

				{#if activeRunState.recorded}
					<!-- The recorded figures, not the run's own tally: the server
					     regraded every answer, and this is what the board now holds. -->
					<p class="ranked hud glow-green">
						ENTRY RECORDED
						{#if activeRunState.recorded.rank !== null}
							— {activeRunState.recorded.rank}<span class="ord"
								>{ordinal(activeRunState.recorded.rank)}</span
							>
						{/if}
					</p>
					{#if activeRunState.recorded.score !== run.score}
						<p class="regraded hud">
							SERVER SCORE <span class="glow-gold num"
								>{activeRunState.recorded.score.toLocaleString()}</span
							>
						</p>
					{/if}
					<a class="cta hud" href={resolve('/ranking')}>VIEW RANKING</a>
				{:else if placement !== null}
					<section class="entry">
						<h2 class="entry-head hud glow-gold">
							RANK IN — {placement}<span class="ord">{ordinal(placement)}</span>
						</h2>
						<p class="entry-sub readable">なまえを入力してください</p>

						<label class="entry-field">
							<span class="visually-hidden">Name for the ranking, up to {NAME_MAX} characters</span>
							<input
								class="entry-input hud"
								bind:value={activeRunState.name}
								maxlength={NAME_MAX}
								autocomplete="off"
								spellcheck="false"
								placeholder="AAA"
								onkeydown={(e) => e.key === 'Enter' && finish()}
							/>
						</label>

						<div class="pad" role="group" aria-label="Character pad">
							{#each NAME_CHARS as char (char)}
								<button class="pad-key hud" onclick={() => pushChar(char)}>{char}</button>
							{/each}
						</div>

						<div class="commit">
							<button
								class="cta ghost hud"
								onclick={backspace}
								disabled={activeRunState.name.length === 0}
							>
								DEL
							</button>
							<button class="cta hud" onclick={finish} disabled={!canSubmit}>
								{sending ? 'SENDING…' : 'ENTER'}
							</button>
						</div>

						{#if submitError}
							<p class="submit-error hud glow-red" role="alert">
								{submitError} — PRESS ENTER TO RETRY
							</p>
						{/if}
					</section>
				{:else}
					<p class="missed hud">
						<span class="glow-beam">NO RANK</span>
						<span class="missed-sub readable">今回はランキングに届きませんでした。</span>
					</p>
				{/if}

				<div class="again">
					<a class="cta ghost hud" href={resolve('/review')}>REVIEW</a>
					<button class="cta ghost hud" onclick={resetActiveRun}>CONTINUE?</button>
					<a class="back hud" href={resolve('/')}>← TITLE</a>
				</div>
			</section>
		{/if}
	</main>
</div>

<style>
	.play {
		--pad: clamp(16px, 3.4vw, 40px);
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.num {
		font-variant-numeric: tabular-nums;
	}

	/* ── HUD ── */
	.hud-bar {
		display: flex;
		align-items: center;
		gap: clamp(12px, 3vw, 34px);
		padding: 12px var(--pad);
		border-bottom: var(--rule) solid #1c2340;
		font-size: clamp(10px, 1.5vw, 13px);
		flex-wrap: wrap;
	}
	.slot {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.slot b {
		font-weight: inherit;
	}
	.marks {
		display: inline-flex;
		gap: 5px;
	}
	.mark {
		width: 11px;
		height: 11px;
		fill: var(--red);
		filter: drop-shadow(0 0 5px rgb(255 59 20 / 0.75));
	}
	.mark.spent {
		fill: #2a3050;
		filter: none;
	}

	/* ── A miss ─────────────────────────────────────────────────────────────
	 * The quiz-show ✕, stamped once in time with the buzzer. The buzzer is a
	 * recording — one hit that decays away rather than two held notes — so the
	 * mark slams in on the attack, holds while the hit is loud, and dies out
	 * with the tail:
	 *
	 *   0–70ms     slam in, overshoot
	 *   70–400ms   held full
	 *   400–740ms  fading, with the decay
	 *
	 * Red, because red threatens: wrong answer is one of its four named jobs.
	 *
	 * ⚠ 740ms is `MISS_CUE_MS` in `#lib/game/sound.svelte.js`, measured off the
	 * audible span of `incorrect.mp3` — the file itself runs a second longer
	 * into silence. Picture and sound are one event on two clocks, and they only
	 * read as one because the numbers agree. Swap the file and remeasure, or the
	 * stamp will sit there over a dead speaker.
	 * -------------------------------------------------------------------- */
	.miss {
		position: absolute;
		inset: 0;
		/* Under .screen::after (z-index 9): the scanlines rake across this too,
		   because it is on the tube and not in front of it. */
		z-index: 8;
		display: grid;
		place-items: center;
		pointer-events: none;
	}

	/* Two elements because the two motions disagree: the stamp's scale wants
	   easing and its lighting must not have any. Nesting lets each keep its own. */
	.miss-pop {
		display: block;
		animation: miss-pop 740ms linear both;
	}
	.batsu {
		display: block;
		width: clamp(120px, 34vw, 220px);
		height: clamp(120px, 34vw, 220px);
		fill: var(--red);
		filter: drop-shadow(0 0 28px rgb(255 59 20 / 0.9));
		animation: miss-stamp 740ms linear forwards;
	}

	/* One pop, on the attack. It overshoots and settles slightly large, so the ✕
	   is still growing into the frame while the buzzer is at its loudest. */
	@keyframes miss-pop {
		0% {
			transform: scale(0.55);
			animation-timing-function: cubic-bezier(0.2, 0.9, 0.4, 1);
		}
		9.5% {
			transform: scale(1.16);
			animation-timing-function: ease-out;
		}
		22% {
			transform: scale(1.06);
		}
		100% {
			transform: scale(1.06);
		}
	}

	/* Lighting tracks the sample's envelope: full while the hit is loud, then
	   down with its tail. Not `steps()` any more — the buzzer no longer switches
	   off, it rings out, and a hard cut would leave the ✕ ahead of the sound. */
	@keyframes miss-stamp {
		0% {
			opacity: 1;
		}
		54% {
			opacity: 1;
			animation-timing-function: ease-in;
		}
		100% {
			opacity: 0;
		}
	}

	/* Reduced motion must still show the miss, not skip it. The global rule
	   collapses every duration, which would flash this out in a frame — so the
	   ✕ is held lit and still instead, and the same script timer that is set to
	   the buzzer's length takes it away. Appears and disappears; never moves. */
	@media (prefers-reduced-motion: reduce) {
		.miss-pop {
			animation: none;
		}
		.batsu {
			animation: none;
			opacity: 0.85;
		}
	}

	/* ── Course select ── */
	.select {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 20px;
		padding: clamp(28px, 6vw, 60px) var(--pad);
		text-align: center;
	}
	.select-head {
		margin: 0;
		font-size: clamp(1.3rem, 4.6vw, 2.1rem);
		letter-spacing: 0.24em;
		text-indent: 0.24em;
	}
	.select-sub {
		margin: 0;
		color: var(--dim);
		font-size: 0.9rem;
	}
	.courses {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: clamp(12px, 3vw, 24px);
		width: min(560px, 100%);
	}
	.course {
		display: grid;
		gap: 6px;
		padding: clamp(20px, 4vw, 30px) 12px;
		background: rgb(43 92 255 / 0.08);
		border: var(--rule) solid var(--blue);
		color: var(--beam);
		font: inherit;
		cursor: pointer;
		transition:
			background 140ms ease-out,
			border-color 140ms ease-out;
	}
	.course:hover,
	.course:focus-visible {
		background: rgb(43 92 255 / 0.24);
		border-color: var(--gold);
	}
	.course-lv {
		font-size: clamp(1.8rem, 6vw, 2.6rem);
		line-height: 1;
	}
	.course-ja {
		font-size: 0.92rem;
		color: var(--beam);
	}
	.course-meta {
		font-size: 10px;
		letter-spacing: 0.16em;
		color: var(--dim);
	}
	.select-rule {
		margin: 0;
		max-width: 42ch;
		color: var(--dim);
		font-size: 0.82rem;
		line-height: 1.75;
	}

	/* ── The round ── */
	.round {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: clamp(14px, 2.4vw, 20px);
		padding: clamp(18px, 4vw, 30px) var(--pad) clamp(22px, 4vw, 34px);
	}
	.round-top {
		display: grid;
		gap: 8px;
	}
	/* The question block owns whatever height the HUD strip leaves. */
	.round-main {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: clamp(14px, 2.4vw, 22px);
	}
	.timer {
		height: 10px;
		background: #141a30;
		border: var(--rule) solid #1c2340;
		overflow: hidden;
	}
	.timer-fill {
		height: 100%;
		background: var(--gold);
		transform-origin: left center;
		box-shadow: 0 0 14px rgb(255 196 0 / 0.6);
	}
	.timer.critical .timer-fill {
		background: var(--red);
		box-shadow: 0 0 14px rgb(255 59 20 / 0.7);
	}
	.timer-read {
		margin: 0;
		display: flex;
		justify-content: space-between;
		font-size: clamp(10px, 1.5vw, 12px);
		color: var(--dim);
	}
	.timer-read.critical .num {
		color: var(--red);
		text-shadow: var(--bloom) rgb(255 59 20 / 0.6);
	}
	.timer-read .num {
		color: var(--gold);
	}

	.tag {
		margin: 0;
		display: flex;
		gap: 10px;
		font-size: clamp(10px, 1.5vw, 12px);
		letter-spacing: 0.18em;
	}
	.tag .dot {
		color: var(--blue);
	}

	.prompt {
		margin: 0;
		font-size: clamp(1.35rem, 5.4vw, 2.5rem);
		line-height: 1.5;
		font-weight: 700;
		color: var(--beam);
		text-shadow: 0 0 18px rgb(200 220 255 / 0.28);
		text-wrap: balance;
	}
	/* The blank is one token: it must never break across lines. */
	.blank {
		white-space: nowrap;
	}

	.choices {
		list-style: none;
		margin: 0;
		padding: 0;
		flex: 1;
		min-height: 0;
		max-height: 460px;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		grid-auto-rows: minmax(72px, 1fr);
		gap: clamp(8px, 1.6vw, 14px);
	}
	/* Constant scale across all four cells: no option may look likelier. */
	.choice {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 16px;
		text-align: start;
		background: #0e1326;
		border: var(--rule) solid #263053;
		color: var(--beam);
		font-size: clamp(0.95rem, 2.9vw, 1.2rem);
		font-family: var(--font-read);
		cursor: pointer;
		transition:
			background 120ms ease-out,
			border-color 120ms ease-out;
	}
	.choice:hover:not(:disabled),
	.choice:focus-visible {
		background: #182142;
		border-color: var(--blue);
	}
	.choice:disabled {
		cursor: default;
	}
	.choice .key {
		flex: none;
		width: 1.9em;
		height: 1.9em;
		display: grid;
		place-items: center;
		border: var(--rule) solid #384470;
		color: var(--dim);
		font-size: 0.72em;
	}
	.choice.correct {
		border-color: var(--green);
		background: rgb(59 232 107 / 0.14);
	}
	.choice.correct .key {
		border-color: var(--green);
		color: var(--green);
	}
	.choice.wrong {
		border-color: var(--red);
		background: rgb(255 59 20 / 0.14);
	}
	.choice.wrong .key {
		border-color: var(--red);
		color: var(--red);
	}

	.verdict {
		min-height: 4.6em;
	}
	.verdict-line {
		margin: 0 0 6px;
		display: flex;
		gap: 14px;
		align-items: baseline;
		font-size: clamp(1rem, 3.4vw, 1.4rem);
		letter-spacing: 0.1em;
	}
	/* The verdict text and NEXT share one row inside the reserved verdict height,
	   so nothing appears under the choice the player just tapped. The button
	   stretches to the height of the verdict line and the gloss together. */
	.verdict-row {
		display: flex;
		align-items: stretch;
		gap: clamp(12px, 2.4vw, 20px);
	}
	.verdict-text {
		flex: 1;
		min-width: 0;
	}
	.verdict-text .verdict-line:last-child {
		margin-bottom: 0;
	}
	.next {
		flex: none;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 clamp(14px, 2.6vw, 24px);
		background: transparent;
		border: var(--rule) solid var(--gold);
		color: var(--gold);
		font-family: var(--font-dot);
		font-size: clamp(0.95rem, 3vw, 1.3rem);
		letter-spacing: 0.14em;
		text-shadow: var(--bloom) rgb(255 196 0 / 0.55);
		box-shadow: 0 0 12px rgb(255 196 0 / 0.3);
		cursor: pointer;
		transition:
			background 120ms ease-out,
			box-shadow 120ms ease-out;
	}
	.next:hover:not(:disabled),
	.next:focus-visible {
		background: rgb(255 196 0 / 0.12);
		box-shadow: 0 0 20px rgb(255 196 0 / 0.55);
	}
	.next:disabled {
		opacity: 0.35;
		text-shadow: none;
		box-shadow: none;
		cursor: default;
	}
	.next .arrow {
		animation: next-blink 1.06s steps(1) infinite;
	}
	.next:disabled .arrow {
		animation: none;
	}
	.next.final {
		border-color: var(--red);
		color: var(--red);
		text-shadow: var(--bloom) rgb(255 59 20 / 0.6);
		box-shadow: 0 0 12px rgb(255 59 20 / 0.35);
	}
	.next.final:hover:not(:disabled),
	.next.final:focus-visible {
		background: rgb(255 59 20 / 0.12);
		box-shadow: 0 0 20px rgb(255 59 20 / 0.6);
	}
	@keyframes next-blink {
		50% {
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.next .arrow {
			animation: none;
		}
	}
	.verdict-gloss {
		margin: 0;
		max-width: 68ch;
		color: var(--dim);
		font-size: clamp(0.78rem, 2.2vw, 0.9rem);
		line-height: 1.7;
	}

	/* ── Game over ── */
	.over {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 18px;
		padding: clamp(24px, 5vw, 52px) var(--pad);
		text-align: center;
	}
	.over-head {
		margin: 0;
		font-size: clamp(1.7rem, 7vw, 3.2rem);
		letter-spacing: 0.2em;
		text-indent: 0.2em;
	}
	.tally {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
		gap: 14px 22px;
		width: min(560px, 100%);
		font-size: clamp(10px, 1.6vw, 12px);
	}
	.tally div {
		display: grid;
		gap: 4px;
	}
	.tally dt {
		color: var(--dim);
		letter-spacing: 0.14em;
	}
	.tally dd {
		margin: 0;
		font-size: clamp(1rem, 3.4vw, 1.4rem);
		color: var(--beam);
	}

	.entry {
		display: grid;
		justify-items: center;
		gap: 12px;
		width: min(560px, 100%);
		padding-top: 6px;
		border-top: var(--rule) solid #1c2340;
	}
	.entry-head {
		margin: 6px 0 0;
		font-size: clamp(1rem, 3.6vw, 1.4rem);
		letter-spacing: 0.16em;
	}
	.entry-head .ord {
		font-size: 0.6em;
	}
	.entry-sub {
		margin: 0;
		color: var(--dim);
		font-size: 0.85rem;
	}
	.entry-input {
		width: min(320px, 90vw);
		padding: 10px 12px;
		background: #0e1326;
		border: var(--rule) solid var(--gold);
		color: var(--gold);
		font-family: var(--font-dot);
		font-size: clamp(1.4rem, 6vw, 2rem);
		letter-spacing: 0.42em;
		text-indent: 0.42em;
		text-align: center;
		text-transform: uppercase;
	}
	.entry-input::placeholder {
		color: #6d5a1e;
	}
	.pad {
		display: grid;
		grid-template-columns: repeat(13, minmax(0, 1fr));
		gap: 4px;
		width: min(520px, 100%);
	}
	.pad-key {
		aspect-ratio: 1;
		display: grid;
		place-items: center;
		background: #0e1326;
		border: var(--rule) solid #263053;
		color: var(--beam);
		font-family: var(--font-dot);
		font-size: clamp(9px, 2vw, 13px);
		cursor: pointer;
	}
	.pad-key:hover,
	.pad-key:focus-visible {
		border-color: var(--gold);
		color: var(--gold);
	}
	.commit {
		display: flex;
		gap: 12px;
		align-items: stretch;
		flex-wrap: wrap;
		justify-content: center;
	}

	.cta {
		padding: 12px 26px;
		background: transparent;
		border: var(--rule) solid var(--gold);
		color: var(--gold);
		font-family: var(--font-dot);
		font-size: clamp(0.85rem, 2.6vw, 1.05rem);
		letter-spacing: 0.2em;
		text-indent: 0.2em;
		text-decoration: none;
		cursor: pointer;
		transition:
			background 140ms ease-out,
			color 140ms ease-out;
	}
	.cta:hover:not(:disabled),
	.cta:focus-visible {
		background: var(--gold);
		color: var(--void);
	}
	.cta:disabled {
		border-color: #3a3f55;
		color: #5b6180;
		cursor: not-allowed;
	}
	.cta.ghost {
		border-color: var(--blue);
		color: var(--beam);
	}
	.cta.ghost:hover,
	.cta.ghost:focus-visible {
		background: var(--blue);
		color: var(--beam);
	}

	.ranked {
		margin: 0;
		letter-spacing: 0.2em;
	}
	.ranked .ord {
		font-size: 0.7em;
	}
	/* Shown only when the server's tally differs from the run's own, which is
	   rare enough to deserve an explanation and too important to hide. */
	.regraded {
		margin: 0;
		color: var(--dim);
		font-size: 11px;
		letter-spacing: 0.16em;
	}
	.submit-error {
		margin: 0;
		max-width: 42ch;
		font-size: 11px;
		letter-spacing: 0.14em;
		line-height: 1.8;
	}
	.missed {
		margin: 0;
		display: grid;
		gap: 6px;
		font-size: 12px;
		letter-spacing: 0.18em;
	}
	.missed-sub {
		color: var(--dim);
		letter-spacing: 0;
		font-size: 0.85rem;
	}
	.again {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 18px;
		flex-wrap: wrap;
		justify-content: center;
		margin-top: 4px;
	}

	.back {
		color: var(--dim);
		text-decoration: none;
		font-size: 11px;
		letter-spacing: 0.16em;
	}
	.back:hover,
	.back:focus-visible {
		color: var(--beam);
	}

	@media (max-width: 560px) {
		.choices {
			grid-template-columns: 1fr;
		}
		.pad {
			grid-template-columns: repeat(9, minmax(0, 1fr));
		}
	}
</style>
