<script lang="ts">
	import { resolve } from '$app/paths'
	import { onMount } from 'svelte'
	import { resetActiveRun } from '#lib/game/run.svelte.js'
	import SoundSwitches from '#lib/components/SoundSwitches.svelte'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	let cursor = $state(0)

	const top = $derived(data.table)
	const showcase = $derived(data.demo.length > 0 ? data.demo[cursor % data.demo.length] : null)

	// The demo reel is the only thing on this screen that moves on its own, and
	// it is cancelled at the source under reduced motion rather than hidden.
	onMount(() => {
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
		if (reduce.matches) return
		const id = setInterval(() => (cursor += 1), 3200)
		return () => clearInterval(id)
	})
</script>

<svelte:head>
	<title>日本語アタック — NIHONGO ATTACK</title>
	<meta
		name="description"
		content="A timed JLPT N3 and N4 vocabulary and grammar quiz, played as an arcade score attack."
	/>
</svelte:head>

<div class="cabinet">
	<main class="screen attract">
		<header class="marquee hud">
			<span class="label glow-red">1UP</span>
			<span class="value glow-gold">0</span>
			<span class="label glow-beam">HI-SCORE</span>
			<span class="value glow-gold">{top[0]?.score.toLocaleString() ?? '0'}</span>
			<span class="label glow-beam">LEVEL</span>
			<span class="value glow-beam">N4 / N3</span>
			<!-- The volume switches ride the marquee rather than floating over the
			     tube: pinned to the corner they sat on top of the score readout the
			     moment the screen narrowed, and in the row they wrap with it. -->
			<div class="switch-slot"><SoundSwitches /></div>
		</header>

		<div class="stage">
			<h1 class="title">
				<span class="title-ja glow-gold">日本語アタック</span>
				<span class="title-en glow-beam">NIHONGO ATTACK</span>
			</h1>

			<p class="tagline hud glow-beam">語彙と文法。１問１０秒。ミス３回で終了。</p>

			<a class="start hud" href={resolve('/play')} onclick={resetActiveRun}>
				<span class="blink">PUSH START</span>
			</a>

			<div class="panels">
				<section class="demo" aria-hidden="true">
					<p class="demo-head hud glow-beam">— DEMO PLAY —</p>
					{#if showcase}
						{#key showcase.id}
							<p class="demo-q readable">{showcase.prompt}</p>
						{/key}
						<ul class="demo-choices">
							{#each showcase.choices as body, i (i)}
								<li class="readable"><span class="demo-key">{'ABCD'[i]}</span>{body}</li>
							{/each}
						</ul>
					{:else}
						<p class="demo-q readable">まもなく開始 — NO QUESTIONS LOADED</p>
					{/if}
				</section>

				<section class="board" aria-label="High score table">
					<h2 class="board-head hud glow-red">HI-SCORE</h2>
					{#if top.length === 0}
						<p class="board-empty hud">NO RUNS RECORDED YET</p>
						<p class="board-note hud">BE FIRST ON THE BOARD</p>
					{:else}
						<ol class="board-list hud">
							{#each top as entry (entry.rank)}
								<li>
									<span class="rank glow-beam">{String(entry.rank).padStart(2, '0')}</span>
									<span class="name glow-gold">{entry.playerName}</span>
									<span class="lv">{entry.level}</span>
									<span class="pts glow-gold">{entry.score.toLocaleString()}</span>
								</li>
							{/each}
						</ol>
					{/if}
				</section>
			</div>
		</div>

		<footer class="tray hud">
			<nav>
				<a class="glow-beam" href={resolve('/ranking')}>RANKING</a>
			</nav>
			<!-- The cabinet's CREDIT readout doubles as the way to the members roll. -->
			<span class="credit">
				<a class="glow-beam" href={resolve('/credit')}>CREDIT</a>&nbsp;&nbsp;<b class="glow-gold"
					>FREE PLAY</b
				>
			</span>
		</footer>
	</main>
</div>

<style>
	.attract {
		--pad: clamp(16px, 3.4vw, 40px);
	}

	.marquee {
		display: flex;
		align-items: center;
		gap: clamp(10px, 2.4vw, 26px);
		padding: 14px var(--pad);
		border-bottom: var(--rule) solid #1c2340;
		font-size: clamp(11px, 1.5vw, 14px);
		flex-wrap: wrap;
	}
	.marquee .value {
		font-variant-numeric: tabular-nums;
	}
	.marquee .label + .value {
		margin-inline-start: -0.4em;
	}
	/* Pushed to the far end of the row, and onto a right-aligned line of its own
	   once the readout beside it runs out of width. */
	.switch-slot {
		margin-inline-start: auto;
	}

	.stage {
		flex: 1;
		/* Scrolls inside the tube: the screen is a fixed rectangle now, so a
		   phase taller than the glass must overrun here, not push the frame. */
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		/* `safe`, so a screen taller than the tube falls back to the top edge
		   instead of overrunning past it where nothing can scroll back. Reasoned
		   out at `.over` in src/routes/play/+page.svelte. */
		justify-content: safe center;
		gap: clamp(16px, 2.4vw, 24px);
		padding: clamp(22px, 3.4vw, 34px) var(--pad);
		text-align: center;
	}

	.title {
		margin: 0;
		display: grid;
		gap: 8px;
	}
	.title-ja {
		display: block;
		font-size: clamp(2.2rem, 7.4vw, 4.4rem);
		line-height: 1;
		letter-spacing: 0.06em;
	}
	.title-en {
		display: block;
		font-size: clamp(0.75rem, 2.4vw, 1.15rem);
		letter-spacing: 0.42em;
		text-indent: 0.42em;
	}

	.tagline {
		margin: 0;
		color: var(--dim);
		font-size: clamp(0.8rem, 2.2vw, 0.98rem);
	}

	.start {
		display: inline-block;
		padding: 14px 30px;
		border: var(--rule) solid var(--gold);
		color: var(--gold);
		text-decoration: none;
		font-size: clamp(1rem, 3vw, 1.35rem);
		letter-spacing: 0.2em;
		text-indent: 0.2em;
		background: rgb(255 196 0 / 0.06);
		text-shadow: var(--bloom) rgb(255 196 0 / 0.5);
		transition:
			background 140ms ease-out,
			color 140ms ease-out;
	}
	.start:hover,
	.start:focus-visible {
		background: var(--gold);
		color: var(--void);
		text-shadow: none;
	}

	/* Demo and board sit side by side wherever there is width for them, so the
	   cabinet never scrolls: an arcade screen has no fold. */
	.panels {
		width: 100%;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: clamp(16px, 3vw, 32px);
		align-items: start;
		justify-items: center;
		max-width: 980px;
	}

	.demo {
		width: 100%;
		max-width: 560px;
		text-align: start;
		border: var(--rule) solid #1c2340;
		padding: 16px;
		display: grid;
		gap: 10px;
	}
	.demo-head {
		margin: 0;
		font-size: 11px;
		letter-spacing: 0.3em;
		opacity: 0.75;
	}
	.demo-q {
		margin: 0;
		font-size: clamp(0.95rem, 2.9vw, 1.2rem);
		color: var(--beam);
		animation: fade 320ms ease-out;
	}
	.demo-key {
		display: inline-block;
		min-width: 1.5em;
	}
	.demo-choices {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 6px 14px;
		font-size: clamp(0.72rem, 2.2vw, 0.86rem);
		color: var(--dim);
		text-align: start;
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.board {
		width: 100%;
		max-width: 560px;
	}
	.board-head {
		margin: 0 0 10px;
		font-size: clamp(0.85rem, 2.4vw, 1rem);
		letter-spacing: 0.3em;
	}
	.board-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 4px;
		font-size: clamp(0.78rem, 2.3vw, 0.94rem);
	}
	.board-list li {
		display: grid;
		grid-template-columns: 2.6em 1fr 3em 6em;
		gap: 8px;
		align-items: baseline;
		text-align: start;
	}
	.board-list .lv,
	.board-empty,
	.board-note {
		color: var(--dim);
	}
	.board-list .pts {
		text-align: end;
		font-variant-numeric: tabular-nums;
	}
	.board-note {
		margin: 12px 0 0;
		font-size: 10px;
		letter-spacing: 0.16em;
	}
	.board-empty {
		margin: 0;
		font-size: 12px;
	}

	.tray {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 14px var(--pad);
		border-top: var(--rule) solid #1c2340;
		font-size: clamp(10px, 1.5vw, 12px);
		flex-wrap: wrap;
	}
	.tray nav {
		display: flex;
		gap: 20px;
	}
	.tray a,
	.credit b {
		text-shadow: var(--bloom) currentColor;
	}
	.tray nav a {
		text-decoration: none;
		border-bottom: var(--rule) solid transparent;
		padding-bottom: 2px;
	}
	.tray a:hover,
	.tray a:focus-visible {
		color: var(--beam);
		border-bottom-color: var(--blue);
	}
	.credit a {
		text-decoration: none;
		border-bottom: var(--rule) solid transparent;
		padding-bottom: 2px;
	}
	.credit b {
		font-weight: inherit;
	}

	/* The marquee is one line on a phone or it is nothing: a score readout that
	   wraps stops reading as the strip across the top of a cabinet. The row buys
	   the width back from its own gaps and tracking, and the switches at the end
	   of it shrink to match. */
</style>
