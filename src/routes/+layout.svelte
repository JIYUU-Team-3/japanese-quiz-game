<script lang="ts">
	import type { Path } from '$app/types'
	import { resolve } from '$app/paths'
	import { page } from '$app/state'
	import { activeRunState } from '#lib/game/run.svelte.js'
	import { locales, localizeHref } from '#lib/paraglide/runtime.js'
	import favicon from '#lib/assets/favicon.svg'
	import { play, setMusic, sound, toggleMute, unlockAudio } from '#lib/game/sound.svelte.js'
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
	 * down. This is also the first gesture of the session, which is the only
	 * moment a browser will let the audio hardware open.
	 */
	function press(event: PointerEvent) {
		const target = event.target
		if (!(target instanceof Element)) return
		const control = target.closest('button, a[href]')
		if (!control) return
		// A dead button gives no travel and so makes no sound: NEXT before it
		// arms, a course that is out of service, ENTER with no name typed.
		if (control instanceof HTMLButtonElement && control.disabled) return
		unlockAudio()
		play('press')
	}

	/**
	 * Where the music stands, decided by which screen is up.
	 *
	 * Here rather than in each screen for the same reason the press cue is: a
	 * route added tomorrow is silent by default, and no screen can forget to
	 * hand the music off on its way out.
	 *
	 * This is deliberately the *only* writer of the music level. When the play
	 * screen also asserted its own, the two raced on the way back from REVIEW —
	 * this effect re-runs on the route change while that screen is mounting, and
	 * whichever landed second won, which resumed the bed under a finished run.
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
		} else if (route === '/credit') {
			// The roll plays the cabinet's own theme, stepped down from the title
			// and restarted from its opening bar — the one screen that gets the
			// track from the top, because a credits roll begins rather than
			// continues. `setMusic` owns that; see the note on it.
			setMusic('credits')
		} else if (route === '/play') {
			// GAME OVER goes quiet: the score the player is about to put their name
			// on should have the room to itself.
			setMusic(activeRunState.run.phase === 'over' ? 'off' : 'play')
		} else {
			setMusic('off')
		}
	})
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<svelte:window onpointerdown={press} />

{@render children()}

<!-- The volume switch lives on the cabinet, not on the tube: it is hardware the
     player reaches for, never part of the picture the game is drawing. -->
<button
	class="sound-switch hud"
	onclick={toggleMute}
	aria-pressed={sound.muted}
	title={sound.muted ? 'Turn sound on' : 'Turn sound off'}
>
	<span class="lamp" class:off={sound.muted} aria-hidden="true"></span>
	SOUND {sound.muted ? 'OFF' : 'ON'}
</button>

<div style="display:none">
	{#each locales as locale (locale)}
		<a href={resolve(localizeHref(page.url.pathname, { locale }) as Path)}>{locale}</a>
	{/each}
</div>

<style>
	.sound-switch {
		position: fixed;
		right: clamp(8px, 2vw, 20px);
		bottom: clamp(8px, 2vw, 20px);
		z-index: 10;
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
