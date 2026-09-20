<script lang="ts">
	import { sound, toggleMusic, toggleSfx } from '#lib/game/sound.svelte.js'

	/**
	 * The cabinet's two volume switches, laid out as one horizontal block.
	 *
	 * Two of them, because turning the music down to play your own is a different
	 * want from turning off the cues that tell you whether you were right.
	 *
	 * They belong to the attract screen only. A player mid-run is reading the
	 * timer, not reaching for hardware, and a switch floating over the quiz is
	 * one more thing between them and the question — so the title screen is
	 * where the settings are set, and every other screen is just the game.
	 */
</script>

<div class="switches">
	<button
		class="sound-switch hud glow-beam"
		type="button"
		onclick={toggleMusic}
		aria-pressed={sound.musicOn}
		title={sound.musicOn ? 'Turn music off' : 'Turn music on'}
	>
		<span class="lamp" class:off={!sound.musicOn} aria-hidden="true"></span>
		<span class="name">BGM</span>
	</button>
	<button
		class="sound-switch hud glow-beam"
		type="button"
		onclick={toggleSfx}
		aria-pressed={sound.sfxOn}
		title={sound.sfxOn ? 'Turn sound effects off' : 'Turn sound effects on'}
	>
		<span class="lamp" class:off={!sound.sfxOn} aria-hidden="true"></span>
		<span class="name">SFX</span>
	</button>
</div>

<style>
	.switches {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: clamp(8px, 1.8vw, 14px);
	}

	.sound-switch {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0;
		font-family: inherit;
		font-size: inherit;
		letter-spacing: inherit;
		line-height: 1;
		white-space: nowrap;
		background: transparent;
		border: none;
		cursor: pointer;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
		transition:
			color 120ms ease-out,
			text-shadow 120ms ease-out;
	}
	.sound-switch:hover {
		color: var(--gold);
		text-shadow: var(--bloom) rgb(255 196 0 / 0.55);
	}
	.sound-switch:focus-visible {
		outline: var(--rule) solid var(--gold);
		outline-offset: 3px;
	}

	/* The switch's own indicator: lit gold when the cabinet has a voice, dead
	   grey when it does not. */
	.lamp {
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--gold);
		box-shadow: 0 0 8px rgb(255 196 0 / 0.9);
	}
	/* Hollow when off, filled when on. */
	.lamp.off {
		background: transparent;
		border: 1.5px solid #3a4570;
		box-shadow: none;
	}

	@media (max-width: 480px) {
		.switches {
			gap: 8px;
		}
		.sound-switch {
			gap: 4px;
		}
		.lamp {
			width: 7px;
			height: 7px;
		}
	}
</style>
