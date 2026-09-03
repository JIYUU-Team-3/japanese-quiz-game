<script lang="ts">
	import { resolve } from '$app/paths'
	import { onMount } from 'svelte'
	import { fetchQuestions } from '#lib/game/api.js'
	import { PLAYABLE_LEVELS, type JlptLevel } from '#lib/game/types.js'

	let counts = $state<Partial<Record<JlptLevel, number>>>({})

	onMount(() => {
		void (async () => {
			const banks = await Promise.all(PLAYABLE_LEVELS.map((l) => fetchQuestions(l)))
			counts = Object.fromEntries(PLAYABLE_LEVELS.map((l, i) => [l, banks[i].length]))
		})()
	})

	// Individual member names are not recorded anywhere in this project, so they
	// are left as slots for the team to fill rather than invented.
	const roll = [
		{ role: 'PLANNING', names: ['JIYUU-TEAM-3'] },
		{ role: 'FRONTEND', names: ['—'] },
		{ role: 'BACKEND', names: ['—'] },
		{ role: 'QUESTION DATA', names: ['—'] },
		{ role: 'SPECIAL THANKS', names: ['CADT'] },
	]
</script>

<svelte:head><title>STAFF ROLL — 日本語アタック</title></svelte:head>

<div class="cabinet">
	<main class="screen credits">
		<header class="bar hud">
			<a class="back" href={resolve('/')}>← TITLE</a>
			<span class="glow-beam">STAFF ROLL</span>
		</header>

		<div class="body">
			<p class="congrats hud glow-gold">THANK YOU FOR PLAYING</p>

			<h1 class="title">
				<span class="title-ja glow-beam">日本語アタック</span>
				<span class="title-en">NIHONGO ATTACK</span>
			</h1>

			<dl class="roll hud">
				{#each roll as item (item.role)}
					<div>
						<dt class="glow-beam">{item.role}</dt>
						{#each item.names as person (person)}
							<dd class:slot={person === '—'}>{person}</dd>
						{/each}
					</div>
				{/each}
			</dl>

			<section class="colophon">
				<h2 class="colophon-head hud glow-beam">TECHNICAL</h2>
				<p class="readable">
					SvelteKit・Cloudflare Workers・D1・Drizzle・Paraglide。 出題数は N4 が{counts.N4 ??
						'—'}問、N3 が{counts.N3 ?? '—'}問。
				</p>
				<p class="readable warn">
					出題データは開発用の仮データです。公式のJLPT教材ではありません。
				</p>
			</section>

			<a class="cta hud" href={resolve('/play')}>PUSH START</a>
		</div>
	</main>
</div>

<style>
	.credits {
		--pad: clamp(16px, 3.4vw, 40px);
	}

	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px var(--pad);
		border-bottom: var(--rule) solid #1c2340;
		font-size: clamp(10px, 1.5vw, 12px);
		letter-spacing: 0.16em;
	}
	.back {
		color: var(--dim);
		text-decoration: none;
	}
	.back:hover,
	.back:focus-visible {
		color: var(--beam);
	}

	.body {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: clamp(18px, 3.4vw, 30px);
		padding: clamp(30px, 6vw, 60px) var(--pad);
		text-align: center;
	}

	.congrats {
		margin: 0;
		font-size: clamp(0.8rem, 2.6vw, 1.05rem);
		letter-spacing: 0.3em;
		text-indent: 0.3em;
	}

	.title {
		margin: 0;
		display: grid;
		gap: 6px;
	}
	.title-ja {
		font-size: clamp(1.6rem, 6vw, 2.6rem);
		line-height: 1.1;
		letter-spacing: 0.08em;
	}
	.title-en {
		font-size: clamp(0.68rem, 2vw, 0.85rem);
		letter-spacing: 0.4em;
		text-indent: 0.4em;
		color: var(--dim);
	}

	.roll {
		margin: 0;
		display: grid;
		gap: 20px;
		width: min(460px, 100%);
		font-size: clamp(0.72rem, 2.1vw, 0.86rem);
	}
	.roll div {
		display: grid;
		gap: 6px;
	}
	.roll dt {
		font-size: 10px;
		letter-spacing: 0.26em;
		text-indent: 0.26em;
	}
	.roll dd {
		margin: 0;
		font-size: clamp(0.95rem, 3vw, 1.15rem);
		color: var(--gold);
		text-shadow: var(--bloom) rgb(255 196 0 / 0.4);
	}
	.roll dd.slot {
		color: #4a5378;
		text-shadow: none;
	}

	.colophon {
		width: min(560px, 100%);
		display: grid;
		gap: 8px;
		padding-top: 18px;
		border-top: var(--rule) solid #1c2340;
	}
	.colophon-head {
		margin: 0;
		font-size: 10px;
		letter-spacing: 0.26em;
		text-indent: 0.26em;
	}
	.colophon p {
		margin: 0;
		color: var(--dim);
		font-size: 0.82rem;
		line-height: 1.9;
	}
	.colophon .warn {
		color: #b98b3f;
	}

	.cta {
		padding: 12px 26px;
		border: var(--rule) solid var(--gold);
		color: var(--gold);
		text-decoration: none;
		font-size: clamp(0.85rem, 2.6vw, 1rem);
		letter-spacing: 0.2em;
		text-indent: 0.2em;
		transition:
			background 140ms ease-out,
			color 140ms ease-out;
	}
	.cta:hover,
	.cta:focus-visible {
		background: var(--gold);
		color: var(--void);
	}
</style>
