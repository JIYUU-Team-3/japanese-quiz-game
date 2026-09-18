<script lang="ts">
	import type { Path } from '$app/types'
	import { resolve } from '$app/paths'
	import { page } from '$app/state'
	import { locales, localizeHref } from '#lib/paraglide/runtime.js'
	import favicon from '#lib/assets/favicon.svg'
	import { play, sound, toggleMute, unlockAudio } from '#lib/game/sound.svelte.js'
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
