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
		class="sound-switch hud"
		type="button"
		onclick={toggleMusic}
		aria-pressed={sound.musicOn}
		title={sound.musicOn ? 'Turn music off' : 'Turn music on'}
	>
		<span class="lamp" class:off={!sound.musicOn} aria-hidden="true"></span>
		<span class="name">BGM</span>
		<!-- The state word is boxed at a fixed width so ON and OFF occupy the same
		     space: a switch that resized as you threw it shoved the row beside it
		     around, and hardware does not change shape when you press it. -->
	</button>
	<button
		class="sound-switch hud"
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
		gap: 6px;
	}

	.sound-switch {
		display: flex;
		align-items: center;
		gap: 6px;
		/* Tall enough to be a target for a thumb, not just a cursor. */
		min-height: 32px;
		padding: 5px 10px;
		font-size: clamp(0.62rem, 1.5vw, 0.68rem);
		letter-spacing: 0.14em;
		white-space: nowrap;
		color: #7d88b4;
		background: #10142a;
		border: var(--rule) solid #232b4e;
		border-radius: 4px;
		cursor: pointer;
		/* No 300ms tap delay, and no double-tap-to-zoom swallowing a press. */
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
	}
	.sound-switch:hover,
	.sound-switch:focus-visible {
		color: var(--beam);
		border-color: #3a4570;
	}

	.state {
		/* Wide enough for OFF at this tracking; ON simply leaves the slack. */
		min-width: 3.1em;
		text-align: start;
	}

	/* The switch's own indicator: lit gold when the cabinet has a voice, dead
	   grey when it does not. Colour is never the only signal — the label beside
	   it says ON or OFF in words. */
	.lamp {
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--gold);
		box-shadow: 0 0 8px rgb(255 196 0 / 0.9);
	}
	/* Hollow when off, filled when on: the lamp has to read as a state on its
	   own, because the word beside it is dropped on a narrow screen and colour
	   alone is not a signal every player receives. */
	.lamp.off {
		background: transparent;
		border: 2px solid #3a4570;
		box-shadow: none;
	}

	/* On a phone the whole marquee has to be one line, and the switches are what
	   gives: they drop to the lamp and the name, and the lamp carries ON or OFF
	   by itself. The word is the first thing to go because it is the one part
	   the lamp can say without it — losing BGM and SFX would leave two
	   unlabelled dots. */
	@media (max-width: 480px) {
		.switches {
			gap: 3px;
		}
		.sound-switch {
			gap: 4px;
			min-height: 28px;
			padding: 4px 5px;
			font-size: 0.62rem;
			letter-spacing: 0.04em;
		}
		.state {
			display: none;
		}
		.lamp {
			width: 7px;
			height: 7px;
		}
	}
</style>
