<script lang="ts">
	import type { Path } from '$app/types'
	import { resolve } from '$app/paths'
	import { page } from '$app/state'
	import { activeRunState } from '#lib/game/run.svelte.js'
	import { locales, localizeHref } from '#lib/paraglide/runtime.js'
	import favicon from '#lib/assets/favicon.svg'
	import {
		play,
		setMusic,
		sound,
		toggleMusic,
		toggleSfx,
		unlockAudio,
	} from '#lib/game/sound.svelte.js'
	import '#lib/styles/arcade.css'

	let { children } = $props()

	/**
	 * The press cue, for every control in the cabinet.
	 *
	 * Delegated from here rather than hung off each button: there are a dozen of
	 * them across four screens and every one of them is the same sound, so an
	 * `onclick` per button would be a dozen places to forget. A control added
	 * tomorrow clicks without anyone remembering to make it.
	 *
	 * `pointerdown`, not `click`, because an arcade button sounds when it goes
	 * down.
	 */
	function press(event: PointerEvent) {
		// Unconditional, and before the cue: any touch of the page at all is the
		// gesture a browser wants before it will let the cabinet make a sound, and
		// waiting for one that lands on a control means a player who opens the
		// credits and only scrolls never hears the music the screen asked for.
		unlockAudio()
		const target = event.target
		if (!(target instanceof Element)) return
		const control = target.closest('button, a[href]')
		if (!control) return
		// A dead button gives no travel and so makes no sound: NEXT before it
		// arms, a course that is out of service, ENTER with no name typed.
		if (control instanceof HTMLButtonElement && control.disabled) return
		play('press')
	}

	/**
	 * Where the music stands, decided by which screen is up.
	 *
	 * Here rather than in each screen for the same reason the press cue is: a
	 * route added tomorrow is silent by default, and no screen can forget to
	 * hand the music off on its way out.
	 *
	 * This is deliberately the *only* writer of the music. When the play
	 * screen also asserted its own, the two raced on the way back from REVIEW —
	 * this effect re-runs on the route change while that screen is mounting, and
	 * whichever landed second won, which resumed the music under a finished run.
	 * One reader of both facts has no such ordering to get wrong. `run` is shared
	 * state that outlives every screen, so reading it here is free.
	 *
	 * Keyed on `route.id` and not on the pathname, because the pathname carries
	 * a locale prefix and the route id does not.
	 */
	$effect(() => {
		const route = page.route.id
		if (route === '/') {
			setMusic('title')
		} else if (route === '/review') {
			// The review is the second half of GAME OVER: you reach it from that
			// screen, to read back the run you just lost. Same track, and since
			// `setMusic` sees no change it simply keeps playing across the
			// navigation — out to the review, and back again.
			setMusic('gameover')
		} else if (route === '/credit' || route === '/ranking') {
			// One theme across both: they are the two screens you read rather than
			// play, and sharing it means crossing between them changes nothing —
			// `setMusic` sees the same track and leaves it running.
			setMusic('credits')
		} else if (route === '/play') {
			// The one screen that changes music without changing route, so it is
			// read off the run's phase rather than the URL.
			//
			// Choosing a course is still the menu, so the title theme carries
			// straight through from the title screen — committing to one is what
			// starts the run, and the quiz theme comes up on the first question.
			// GAME OVER hands over again, a beat late: `setMusic` holds that one
			// until the cue announcing it has rung out.
			const phase = activeRunState.run.phase
			if (phase === 'select') setMusic('title')
			else if (phase === 'over') setMusic('gameover')
			else setMusic('play')
		} else {
			setMusic('off')
		}
	})
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<!-- Keys as well as pointers: they are the other gesture a browser counts as
     activation, and the quiz is playable from the keyboard alone. -->
<svelte:window onpointerdown={press} onkeydown={unlockAudio} />

{@render children()}

<!-- The volume switches live on the cabinet, not on the tube: they are hardware
     the player reaches for, never part of the picture the game is drawing.
     Two of them, because turning the music down to play your own is a different
     want from turning off the cues that tell you whether you were right. -->
<div class="switches">
	<button
		class="sound-switch hud"
		onclick={toggleMusic}
		aria-pressed={sound.musicOn}
		title={sound.musicOn ? 'Turn music off' : 'Turn music on'}
	>
		<span class="lamp" class:off={!sound.musicOn} aria-hidden="true"></span>
		BGM {sound.musicOn ? 'ON' : 'OFF'}
	</button>
	<button
		class="sound-switch hud"
		onclick={toggleSfx}
		aria-pressed={sound.sfxOn}
		title={sound.sfxOn ? 'Turn sound effects off' : 'Turn sound effects on'}
	>
		<span class="lamp" class:off={!sound.sfxOn} aria-hidden="true"></span>
		SFX {sound.sfxOn ? 'ON' : 'OFF'}
	</button>
</div>

<div style="display:none">
	{#each locales as locale (locale)}
		<a href={resolve(localizeHref(page.url.pathname, { locale }) as Path)}>{locale}</a>
	{/each}
</div>

<style>
	/* Stacked and stretched, so the two switches are one block of hardware: the
	   wider label sets the width and BGM sits squarely above SFX. */
	.switches {
		position: fixed;
		right: clamp(8px, 2vw, 20px);
		bottom: clamp(8px, 2vw, 20px);
		z-index: 10;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 6px;
	}

	.sound-switch {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7px 12px;
		font-size: clamp(0.55rem, 1.5vw, 0.68rem);
		letter-spacing: 0.18em;
		color: #7d88b4;
		background: #10142a;
		border: var(--rule) solid #232b4e;
		border-radius: 4px;
		cursor: pointer;
	}
	.sound-switch:hover,
	.sound-switch:focus-visible {
		color: var(--beam);
		border-color: #3a4570;
	}

	/* The switch's own indicator: lit gold when the cabinet has a voice, dead
	   grey when it does not. Colour is never the only signal — the label beside
	   it says ON or OFF in words. */
	.lamp {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--gold);
		box-shadow: 0 0 8px rgb(255 196 0 / 0.9);
	}
	.lamp.off {
		background: #2a3050;
		box-shadow: none;
	}
</style>
