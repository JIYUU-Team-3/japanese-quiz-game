<script lang="ts">
	/**
	 * The cabinet powering on.
	 *
	 * The attract screen is rendered whole on the server precisely so there is no
	 * `LOADING…` frame between arriving and seeing the machine — but two things
	 * arrive after that HTML does and both of them are visible when they land.
	 * The two typefaces swap under the title, and the theme it asked for starts
	 * mid-phrase or stutters on the way in. This holds the tube dark until the
	 * pair of them are ready, so the cabinet comes up once, whole.
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
	 * ⚠ Drawn in the system monospace, never `--font-dot`. This is the screen
	 * that is up *because* the two faces have not arrived; dressing it in one
	 * would make it the first thing to reflow when they do.
	 */
	import { onMount } from 'svelte'
	import { musicProgress } from '#lib/game/sound.svelte.js'

	let { children } = $props()

	/**
	 * The shortest time the boot screen is allowed to be up.
	 *
	 * A warm reload has both the fonts and the theme in cache and would otherwise
	 * flash this for two frames, which reads as a glitch rather than a machine
	 * starting. Held long enough to be one deliberate beat.
	 */
	const FLOOR_MS = 700

	/**
	 * The longest anything gets to hold the cabinet dark.
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
	 * Whether this is running at all.
	 *
	 * The overlay is server-rendered but the `inert` below is not, because CSS
	 * can hide an element and cannot un-inert one: with scripting off, an
	 * `inert` in the HTML would be permanent and the whole game unreachable
	 * behind a boot screen `app.html` has already hidden. Set from `onMount`, so
	 * it is only ever true where something exists to turn it off again.
	 */
	let running = $state(false)
	let fontsReady = $state(false)
	let musicAt = $state(0)
	/** Fading out: still painted, no longer covering. */
	let leaving = $state(false)
	/** Gone. The overlay leaves the DOM rather than sitting in it transparent. */
	let done = $state(false)

	const progress = $derived((fontsReady ? FONT_SHARE : 0) + musicAt * (1 - FONT_SHARE))
	const percent = $derived(Math.round(progress * 100))

	onMount(() => {
		const startedAt = performance.now()
		let reveal: ReturnType<typeof setTimeout> | undefined
		running = true

		// The two faces are asked for by name and by the characters that actually
		// need them, rather than waiting on `fonts.ready` alone: the Google Fonts
		// CSS is subset by `unicode-range`, so a face is only fetched once a glyph
		// in its range is used, and `ready` can resolve before that has happened.
		if (document.fonts) {
			void Promise.all([
				document.fonts.load('1rem DotGothic16', '日本語アタック'),
				document.fonts.load('1rem "BIZ UDPGothic"', 'あア亜'),
				document.fonts.ready,
			])
				.catch(() => undefined)
				// A face that will not load costs its own legibility, not the boot.
				.then(() => (fontsReady = true))
		} else {
			fontsReady = true
		}

		const poll = setInterval(() => {
			// Clamped upward only. Browsers are free to evict what they have
			// buffered, and a bar that runs backwards looks broken even when the
			// number under it is honest.
			musicAt = Math.max(musicAt, musicProgress())
			const waited = performance.now() - startedAt
			if (waited < FLOOR_MS) return
			if (!((fontsReady && musicAt >= 1) || waited >= CEILING_MS)) return
			clearInterval(poll)
			leaving = true
			reveal = setTimeout(() => (done = true), FADE_MS)
		}, POLL_MS)

		return () => {
			clearInterval(poll)
			clearTimeout(reveal)
		}
	})
</script>

<!-- `display: contents` so the cabinet below still measures itself against the
     viewport and not against a wrapper. -->
<div style="display: contents" inert={running && !done}>
	{@render children()}
</div>

{#if !done}
	<!-- The id is the handle `app.html` reaches for to hide this without
	     scripting; a scoped class would not survive the build under that name. -->
	<div id="boot-screen" class="boot" class:leaving aria-hidden={leaving} style:--fade="{FADE_MS}ms">
		<div class="plate">
			<p class="mark">NIHONGO ATTACK</p>
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

	.mark {
		margin: 0;
		color: var(--gold);
		font-size: clamp(0.9rem, 4vw, 1.4rem);
		letter-spacing: 0.42em;
		text-indent: 0.42em;
		text-shadow: var(--bloom) rgb(255 196 0 / 0.5);
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
		.boot {
			transition: none;
		}
	}
</style>
