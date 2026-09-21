<script lang="ts">
	/**
	 * The cabinet powering on.
	 *
	 * Two jobs, in order. First the gate. A browser will not let this cabinet
	 * make a sound until the player has touched it, so rather than bring the
	 * title screen up silent and wait for whatever they happen to press first,
	 * the press is asked for up front — PRESS ANY BUTTON — and that press is the
	 * one that opens the audio. Everything after it can then arrive with sound.
	 *
	 * Then the load. The attract screen is rendered whole on the server so there
	 * is no `LOADING…` frame between arriving and seeing it, but two things arrive
	 * after that HTML and both are visible when they land: the two typefaces swap
	 * under the title, and its theme stutters in. The screen stays covered until
	 * both are ready, so the cabinet comes up once, whole, with its music fading
	 * in as it does.
	 *
	 * Loading starts at mount, not at the press: time at the gate is time the
	 * load gets for free. A player who reads the gate before pressing usually
	 * finds it finished and never sees the bar at all.
	 *
	 * Rendered on the server too, and not only after hydration. Mounting it
	 * client-side would show the attract screen first and then cover it, which is
	 * the flash this exists to remove, in reverse.
	 *
	 * Wraps the app rather than sitting beside it so it owns both halves of the
	 * same fact: what is over the screen, and whether what is under it can be
	 * reached. An overlay that only covers still hands keyboard focus to the
	 * links behind it.
	 *
	 * ⚠ The prompt and the bar are drawn in the system monospace, never
	 * `--font-dot`: this is the screen that is up *because* the two faces have
	 * not arrived, and dressing them in one would make them the first thing to
	 * reflow when it did. The title is the one exception — it is the homepage's
	 * 日本語アタック in DotGothic16 — and it earns that by staying dark until its
	 * own seven glyphs have loaded. See `titleLit`.
	 */
	import { onMount } from 'svelte'
	import { musicProgress, powerOn, unlockAudio } from '#lib/game/sound.svelte.js'

	let { children } = $props()

	/**
	 * The shortest time the bar stays up once it has had to appear.
	 *
	 * Measured from the press. A load that finishes a moment after it would
	 * otherwise flash the bar for two frames, which reads as a glitch rather than
	 * a machine starting. A load that finished *before* the press skips the bar
	 * outright and is not held at all.
	 */
	const FLOOR_MS = 500

	/**
	 * The longest the bar gets to hold the cabinet dark after the press.
	 *
	 * Nothing on screen is load-bearing on sound — the game is completely
	 * playable in silence — so a theme still crawling in over a bad connection
	 * must not be able to keep a player out of it. The bar stops where it got to
	 * and the machine comes up anyway; the track finishes loading behind it and
	 * is simply late.
	 */
	const CEILING_MS = 8000

	/** How much of the bar the typefaces are worth; the theme has the rest. */
	const FONT_SHARE = 0.3

	/** How often the loading state is read. Slower than a frame — see `.fill`. */
	const POLL_MS = 100

	/**
	 * The reveal.
	 *
	 * Handed to the stylesheet as a custom property rather than written out in
	 * both places: the timer that removes the element and the transition that
	 * fades it are one duration, and two copies of it is one copy that can be
	 * changed alone — leaving either a cut-off fade or a transparent lid.
	 */
	const FADE_MS = 420

	/**
	 * Keys that are not a press: they only modify another key, or move focus, or
	 * — Escape — do not count as the player acting on the page at all, so a
	 * browser would still refuse the sound they were meant to unlock.
	 */
	const NOT_A_PRESS = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Escape'])

	/**
	 * Whether this is running at all.
	 *
	 * The overlay is server-rendered but the `inert` below is not, because CSS
	 * can hide an element and cannot un-inert one: with scripting off, an
	 * `inert` in the HTML would be permanent and the whole game unreachable
	 * behind a boot screen `app.html` has already hidden. Set from `onMount`, so
	 * it is only ever true where something exists to turn it off again. It also
	 * holds the prompt back until there is script to answer it: a press on the
	 * server-rendered gate before hydration would go nowhere.
	 */
	let running = $state(false)
	/**
	 * Where the boot has got to. `leaving` is still painted but no longer
	 * covering; `done` has left the DOM rather than sitting in it transparent.
	 */
	let phase = $state<'gate' | 'loading' | 'leaving' | 'done'>('gate')
	/**
	 * Whether the bar has been shown. Separate from `phase` because a press that
	 * finds the load already done goes straight from the gate to the reveal, and
	 * that fade should carry the prompt out, not flash a bar reading 100%.
	 */
	let barShown = $state(false)
	/**
	 * Whether the title's face has landed.
	 *
	 * The title is held at zero opacity until then and fades in after, so the
	 * player sees it arrive once in the dot face instead of drawn in a fallback
	 * and swapped. Opacity rather than `{#if}`, so the prompt below does not
	 * move when it lights. Only DotGothic16 for these seven glyphs gates it,
	 * which is one small subset: it lights long before the whole load is done.
	 */
	let titleLit = $state(false)
	let fontsReady = $state(false)
	let musicAt = $state(0)
	let pressedAt = 0
	let poll: ReturnType<typeof setInterval> | undefined
	let reveal: ReturnType<typeof setTimeout> | undefined

	const progress = $derived((fontsReady ? FONT_SHARE : 0) + musicAt * (1 - FONT_SHARE))
	const percent = $derived(Math.round(progress * 100))

	function ready(): boolean {
		// Clamped upward only. Browsers are free to evict what they have buffered,
		// and a bar that runs backwards looks broken even when the number under it
		// is honest.
		musicAt = Math.max(musicAt, musicProgress())
		return fontsReady && musicAt >= 1
	}

	function leave() {
		clearInterval(poll)
		phase = 'leaving'
		// With the reveal, not after it: the track's fade-in is longer than the
		// screen's, so the two arrive together and the music finishes settling
		// over a cabinet that is already there.
		powerOn()
		reveal = setTimeout(() => (phase = 'done'), FADE_MS)
	}

	function press() {
		if (phase !== 'gate' || !running) return
		// Called here, inside the gesture, rather than left to the layout's own
		// handler for every press: this is the press that exists for it.
		unlockAudio()
		pressedAt = performance.now()
		if (ready()) return leave()
		phase = 'loading'
		barShown = true
	}

	function onKey(event: KeyboardEvent) {
		if (phase !== 'gate' || event.repeat) return
		// A shortcut is the browser's, not the cabinet's: a reload or a new tab
		// must not be swallowed as a press.
		if (event.metaKey || event.ctrlKey || event.altKey || NOT_A_PRESS.has(event.key)) return
		// Enter or Space on the focused gate would otherwise also fire its click,
		// and Space would scroll whatever is behind.
		event.preventDefault()
		press()
	}

	onMount(() => {
		running = true

		// The two faces are asked for by name and by the characters that actually
		// need them, rather than waiting on `fonts.ready` alone: the Google Fonts
		// CSS is subset by `unicode-range`, so a face is only fetched once a glyph
		// in its range is used, and `ready` can resolve before that has happened.
		if (document.fonts) {
			const title = document.fonts
				.load('1rem DotGothic16', '日本語アタック')
				.catch(() => undefined)
				// A face that will not load lights the title in the fallback rather
				// than leaving the gate without a name.
				.then(() => (titleLit = true))
			void Promise.all([
				title,
				document.fonts.load('1rem "BIZ UDPGothic"', 'あア亜'),
				document.fonts.ready,
			])
				.catch(() => undefined)
				// A face that will not load costs its own legibility, not the boot.
				.then(() => (fontsReady = true))
		} else {
			titleLit = true
			fontsReady = true
		}

		// Polled from mount and not from the press, so the bar is already honest
		// the moment it appears.
		poll = setInterval(() => {
			const loaded = ready()
			if (phase !== 'loading') return
			const waited = performance.now() - pressedAt
			if ((loaded && waited >= FLOOR_MS) || waited >= CEILING_MS) leave()
		}, POLL_MS)

		return () => {
			clearInterval(poll)
			clearTimeout(reveal)
		}
	})
</script>

<svelte:window onkeydown={onKey} />

<!-- `display: contents` so the cabinet below still measures itself against the
     viewport and not against a wrapper. -->
<div style="display: contents" inert={running && phase !== 'done'}>
	{@render children()}
</div>

{#if phase !== 'done'}
	<!-- The id is the handle `app.html` reaches for to hide this without
	     scripting; a scoped class would not survive the build under that name. -->
	<div
		id="boot-screen"
		class="boot"
		class:leaving={phase === 'leaving'}
		aria-hidden={phase === 'leaving'}
		style:--fade="{FADE_MS}ms"
	>
		<div class="plate">
			<!-- `lang` so a fallback, if it ever shows, picks Japanese glyph forms. -->
			<p class="mark" class:lit={titleLit} lang="ja">日本語アタック</p>
			<div class="slot">
				{#if !barShown}
					{#if running}
						<button class="gate" onclick={press}>
							<span class="blink">PRESS ANY BUTTON</span>
						</button>
					{/if}
				{:else}
					<div
						class="bar"
						role="progressbar"
						aria-label="Loading"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={percent}
					>
						<span class="fill" style:width="{percent}%"></span>
					</div>
					<p class="status">LOADING {percent}%</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.boot {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: grid;
		place-items: center;
		padding: 24px;
		/* The same ground the cabinet stands on, so the reveal changes what is on
		   the screen without the room behind it moving. */
		background: radial-gradient(120% 90% at 50% 0%, #0d1226 0%, var(--void) 62%), var(--void);
		opacity: 1;
		transition: opacity var(--fade) ease-out;
	}
	.boot.leaving {
		opacity: 0;
		pointer-events: none;
	}

	.plate {
		display: grid;
		justify-items: center;
		gap: 18px;
		/* Already on the machine, so nothing here swaps when the two land. */
		font-family: ui-monospace, 'Courier New', monospace;
		text-transform: uppercase;
		letter-spacing: 0.3em;
		text-indent: 0.3em;
		font-size: clamp(10px, 2.2vw, 13px);
	}

	/* Holds the height of the bar and its readout, so swapping the prompt for
	   them at the press does not move the title above. */
	.slot {
		display: grid;
		justify-items: center;
		align-content: start;
		gap: 18px;
		min-height: 58px;
	}

	.gate {
		appearance: none;
		margin: 0;
		padding: 8px 12px;
		border: 0;
		background: none;
		font: inherit;
		letter-spacing: inherit;
		text-indent: inherit;
		text-transform: inherit;
		color: var(--beam);
		text-shadow: var(--bloom) rgb(200 220 255 / 0.35);
		cursor: pointer;
	}
	/* Stretched over the whole boot screen, so a tap anywhere is the press —
	   "any button" — while there is still one real, focusable control for the
	   keyboard and for assistive technology to find. */
	.gate::before {
		content: '';
		position: absolute;
		inset: 0;
	}

	/* The homepage's `.title-ja`, set the same so the reveal lands the title on
	   the name the player has just been looking at. */
	.mark {
		margin: 0;
		font-family: var(--font-dot);
		font-size: clamp(2.2rem, 7.4vw, 4.4rem);
		line-height: 1;
		letter-spacing: 0.06em;
		text-indent: 0.06em;
		text-transform: none;
		color: var(--gold);
		text-shadow: var(--bloom) rgb(255 196 0 / 0.55);
		opacity: 0;
		transition: opacity 320ms ease-out;
	}
	.mark.lit {
		opacity: 1;
	}

	.bar {
		position: relative;
		width: min(320px, 64vw);
		height: 16px;
		padding: 2px;
		border: var(--rule) solid var(--blue);
		background: rgb(43 92 255 / 0.08);
	}
	.fill {
		display: block;
		height: 100%;
		background: var(--gold);
		box-shadow: 0 0 10px rgb(255 196 0 / 0.55);
		/* Carries the bar between polls, so a reading every 100ms still draws as
		   one continuous sweep rather than eight steps. */
		transition: width 200ms linear;
	}
	/* Ruled into blocks over the top: a bar on a cabinet is lamps, not a line. */
	.bar::after {
		content: '';
		position: absolute;
		inset: 2px;
		pointer-events: none;
		background: repeating-linear-gradient(to right, transparent 0 8px, var(--void) 8px 10px);
	}

	.status {
		margin: 0;
		color: var(--dim);
		font-variant-numeric: tabular-nums;
	}

	@media (prefers-reduced-motion: reduce) {
		/* The global rule already collapses the durations; this keeps the fill
		   from being the one thing that still slides. */
		.fill,
		.mark,
		.boot {
			transition: none;
		}
	}
</style>
