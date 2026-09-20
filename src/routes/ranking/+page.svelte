<script lang="ts">
	import { resolve } from '$app/paths'
	import { ApiError, fetchLeaderboard } from '#lib/game/api.js'
	import { resetActiveRun } from '#lib/game/run.svelte.js'
	import {
		PLAYABLE_LEVELS,
		TABLE_SIZE,
		type JlptLevel,
		type LeaderboardRow,
	} from '#lib/game/types.js'

	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	type Filter = 'ALL' | JlptLevel
	const FILTERS: Filter[] = ['ALL', ...PLAYABLE_LEVELS]

	let filter = $state<Filter>('ALL')
	let pending = $state(false)
	let failure = $state<string | null>(null)

	// Null means "showing what the server rendered". A filter press replaces it;
	// a navigation back to this page drops it and the fresh load shows through.
	let fetched = $state<LeaderboardRow[] | null>(null)
	const rows = $derived(fetched ?? data.table)

	/**
	 * Pressing a filter is a fresh read of `sessions_leaderboard_idx` on (level,
	 * mode, score) — the server does the filtering, not this page, so a course
	 * board is a real top ten and not the overall top ten with rows removed.
	 *
	 * The unfiltered board arrives with the document, so the first paint costs
	 * no request. Every request after that is racing the player's next press,
	 * which is what the `filter === next` guards settle.
	 */
	async function select(next: Filter) {
		if (next === filter && !failure) return
		filter = next
		failure = null
		pending = true
		try {
			const board = await fetchLeaderboard(next === 'ALL' ? null : next)
			if (filter === next) fetched = board
		} catch (cause) {
			if (filter !== next) return
			fetched = []
			failure = cause instanceof ApiError ? cause.message : 'SERVER ERROR'
		} finally {
			if (filter === next) pending = false
		}
	}

	function goBack() {
		if (typeof window !== 'undefined' && window.history.length > 1) {
			window.history.back()
		} else {
			window.location.href = resolve('/play')
		}
	}
</script>

<svelte:head><title>RANKING — 日本語アタック</title></svelte:head>

<div class="cabinet">
	<main class="screen ranking">
		<header class="bar hud">
			<button class="back-btn hud" type="button" onclick={goBack} aria-label="Previous screen"
				>←</button
			>
			<span class="glow-beam">TOP {TABLE_SIZE}</span>
		</header>

		<div class="body">
			<h1 class="head hud glow-gold">RANKING</h1>
			<p class="sub hud glow-beam">ハイスコアランキング</p>

			<div class="filters hud" role="group" aria-label="Filter by course">
				{#each FILTERS as f (f)}
					<button class="filter" class:on={filter === f} onclick={() => select(f)}>{f}</button>
				{/each}
			</div>

			{#if pending}
				<p class="state hud">LOADING…</p>
			{:else if failure}
				<div class="state empty">
					<p class="hud glow-red">{failure}</p>
					<p class="readable">ランキングを読み込めませんでした。</p>
					<button class="cta hud" onclick={() => select(filter)}>RETRY</button>
				</div>
			{:else if rows.length === 0}
				<div class="state empty">
					<p class="hud glow-beam">NO ENTRIES</p>
					<p class="readable">
						{filter === 'ALL' ? 'まだ記録がありません。' : `${filter}のスコアはまだありません。`}
					</p>
					<a class="cta hud" href={resolve('/play')} onclick={resetActiveRun}>PUSH START</a>
				</div>
			{:else}
				<ol class="table hud">
					<li class="row header-row" aria-hidden="true">
						<span class="rank">RANK</span>
						<span class="name">NAME</span>
						<span class="lv">LV</span>
						<span class="solved">SOLVED</span>
						<span class="streak">STREAK</span>
						<span class="pts">SCORE</span>
					</li>
					{#each rows as entry (entry.rank)}
						<li class="row" class:top={entry.rank === 1}>
							<span class="rank glow-beam">{String(entry.rank).padStart(2, '0')}</span>
							<span class="name glow-gold">{entry.playerName}</span>
							<span class="lv">{entry.level}</span>
							<span class="solved num">{entry.correctCount}</span>
							<span class="streak num">{entry.maxStreak}</span>
							<span class="pts glow-gold num">{entry.score.toLocaleString()}</span>
						</li>
					{/each}
				</ol>

				<a class="cta hud" href={resolve('/play')} onclick={resetActiveRun}>PUSH START</a>
			{/if}
		</div>
	</main>
</div>

<style>
	.ranking {
		--pad: clamp(16px, 3.4vw, 40px);
	}
	.num {
		font-variant-numeric: tabular-nums;
	}

	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px var(--pad);
		border-bottom: var(--rule) solid #1c2340;
		font-size: clamp(10px, 1.5vw, 12px);
		letter-spacing: 0.16em;
		flex-shrink: 0;
	}
	.back-btn {
		background: transparent;
		border: none;
		padding: 4px 8px;
		color: var(--dim);
		font-family: inherit;
		font-size: clamp(14px, 2vw, 18px);
		line-height: 1;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: color 120ms ease-out;
	}
	.back-btn:hover,
	.back-btn:focus-visible {
		color: var(--beam);
	}

	.body {
		--y-pad: clamp(24px, 3.8vh, 36px);
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		gap: clamp(8px, 1.4vh, 14px);
		padding: var(--y-pad) var(--pad) calc(var(--y-pad) + 12px);
		text-align: center;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--blue) transparent;
	}

	.head {
		margin: 0;
		font-size: clamp(1.4rem, 4.5vw, 2.2rem);
		letter-spacing: 0.24em;
		text-indent: 0.24em;
		line-height: 1.1;
	}
	.sub {
		margin: 0;
		color: var(--dim);
		font-size: 0.82rem;
	}

	.filters {
		display: flex;
		gap: 8px;
	}
	.filter {
		padding: 6px 16px;
		background: transparent;
		border: var(--rule) solid #263053;
		color: var(--dim);
		font-family: var(--font-dot);
		font-size: 11px;
		letter-spacing: 0.16em;
		cursor: pointer;
	}
	.filter:hover,
	.filter:focus-visible {
		color: var(--beam);
		border-color: var(--blue);
	}
	.filter.on {
		border-color: var(--gold);
		color: var(--gold);
		background: rgb(255 196 0 / 0.08);
	}

	.table {
		list-style: none;
		margin: 0;
		padding: 0;
		width: min(760px, 100%);
		display: grid;
		gap: 3px;
		font-size: clamp(0.7rem, 1.8vh, 0.88rem);
	}
	.row {
		display: grid;
		grid-template-columns: 3.2rem 1fr 2.8rem 5rem 5rem 6.2rem;
		gap: 10px;
		align-items: baseline;
		text-align: start;
		padding: 4px 10px;
		border: var(--rule) solid transparent;
	}
	.header-row {
		color: var(--dim);
		font-size: 10px;
		letter-spacing: 0.14em;
		border-bottom-color: #1c2340;
		padding-bottom: 3px;
	}

	.row.top {
		border-color: var(--gold);
		background: rgb(255 196 0 / 0.07);
	}
	.row .lv,
	.row .name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.row .solved,
	.row .streak {
		color: var(--dim);
		text-align: center;
	}
	.row .pts {
		text-align: end;
	}

	.state {
		display: grid;
		gap: 12px;
		justify-items: center;
		padding: clamp(24px, 6vw, 48px) 0;
		color: var(--dim);
		font-size: 12px;
		letter-spacing: 0.16em;
	}
	.state.empty p:last-of-type {
		letter-spacing: 0;
		font-size: 0.9rem;
	}

	.cta {
		margin-top: auto;
		background: transparent;
		font-family: var(--font-dot);
		cursor: pointer;
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

	@media (max-width: 620px) {
		.row {
			grid-template-columns: 2.8rem 1fr 2.4rem 5.4rem;
		}
		.row .solved,
		.row .streak {
			display: none;
		}
	}

	@media (max-width: 380px) {
		.row {
			grid-template-columns: 2.4rem 1fr 2.2rem 4.8rem;
			gap: 6px;
			padding: 4px 6px;
			font-size: 0.76rem;
		}
	}
</style>
