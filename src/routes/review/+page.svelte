<script lang="ts">
	import { onMount } from 'svelte'
	import { resolve } from '$app/paths'
	import {
		activeRunState,
		resetActiveRun,
		loadReviewStorage,
		type StoredReview,
	} from '#lib/game/run.svelte.js'

	const run = activeRunState.run
	let stored = $state<StoredReview | null>(null)

	onMount(() => {
		if (run.history.length === 0) {
			stored = loadReviewStorage()
		}
	})

	const historyItems = $derived(run.history.length > 0 ? run.history : (stored?.history ?? []))
	const level = $derived(run.level ?? stored?.level ?? null)
	const score = $derived(run.history.length > 0 ? run.score : (stored?.score ?? 0))

	type ReviewFilter = 'ALL' | 'WRONG' | 'CORRECT'
	let filter = $state<ReviewFilter>('ALL')

	const solvedCount = $derived(historyItems.filter((item) => item.isCorrect).length)
	const wrongCount = $derived(historyItems.filter((item) => !item.isCorrect).length)
	const totalCount = $derived(historyItems.length)
	const accuracy = $derived(totalCount > 0 ? Math.round((solvedCount / totalCount) * 100) : 0)

	const displayedItems = $derived.by(() => {
		if (filter === 'WRONG') return historyItems.filter((item) => !item.isCorrect)
		if (filter === 'CORRECT') return historyItems.filter((item) => item.isCorrect)
		return historyItems
	})

	function goBack() {
		if (typeof window !== 'undefined' && window.history.length > 1) {
			window.history.back()
		} else {
			window.location.href = resolve('/play')
		}
	}
</script>

<svelte:head><title>REVIEW — 日本語アタック</title></svelte:head>

<div class="cabinet">
	<main class="screen review">
		<header class="bar hud">
			<button class="back-btn hud" type="button" onclick={goBack} aria-label="Previous screen"
				>←</button
			>
			<span class="glow-beam">REVIEW</span>
			<span class="glow-gold num">{level ? `${level} COURSE` : 'RUN REVIEW'}</span>
		</header>

		<div class="body">
			{#if historyItems.length === 0}
				<div class="state empty">
					<p class="hud glow-beam">NO REVIEW DATA</p>
					<p class="readable">まだプレイ記録がありません。ゲームをプレイしてください。</p>
					<a class="cta hud" href={resolve('/play')} onclick={resetActiveRun}>PUSH START</a>
				</div>
			{:else}
				<div class="summary-card">
					<div class="summary-stat">
						<span class="stat-label hud">SCORE</span>
						<span class="stat-value hud glow-gold num">{score.toLocaleString()}</span>
					</div>
					<div class="summary-divider"></div>
					<div class="summary-stat">
						<span class="stat-label hud">SOLVED</span>
						<span class="stat-value hud glow-green num">{solvedCount}</span>
					</div>
					<div class="summary-divider"></div>
					<div class="summary-stat">
						<span class="stat-label hud">WRONG</span>
						<span class="stat-value hud glow-red num">{wrongCount}</span>
					</div>
					<div class="summary-divider"></div>
					<div class="summary-stat">
						<span class="stat-label hud">ACCURACY</span>
						<span class="stat-value hud glow-beam num">{accuracy}%</span>
					</div>
				</div>

				<div class="filters hud" role="group" aria-label="Filter questions">
					<button class="filter" class:on={filter === 'ALL'} onclick={() => (filter = 'ALL')}>
						ALL ({totalCount})
					</button>
					<button class="filter" class:on={filter === 'WRONG'} onclick={() => (filter = 'WRONG')}>
						WRONG ({wrongCount})
					</button>
					<button
						class="filter"
						class:on={filter === 'CORRECT'}
						onclick={() => (filter = 'CORRECT')}
					>
						CORRECT ({solvedCount})
					</button>
				</div>

				<div class="question-list">
					{#each displayedItems as item, idx (item.question?.id ? item.question.id + '-' + idx : idx)}
						{@const parts = (item.question?.prompt ?? '').split('＿＿＿')}
						<article
							class="q-card"
							class:card-wrong={!item.isCorrect}
							class:card-correct={item.isCorrect}
						>
							<header class="q-card-header hud">
								<div class="q-meta">
									<span class="q-num glow-gold"
										>{item.roundNumber ? `Q${item.roundNumber}` : `#${idx + 1}`}</span
									>
									<span class="q-level">{item.question?.level ?? '—'}</span>
									<span class="dot">·</span>
									<span class="q-topic">{item.question?.topic?.nameJa ?? '—'}</span>
								</div>
								<div class="q-status">
									{#if item.timedOut}
										<span class="badge time-up glow-red">TIME UP</span>
									{:else if !item.isCorrect}
										<span class="badge wrong glow-red">WRONG</span>
									{:else}
										<span class="badge correct glow-green">CORRECT</span>
									{/if}
								</div>
							</header>

							<h2 class="q-prompt readable">
								{#each parts as part, pIdx (pIdx)}
									{part}{#if pIdx < parts.length - 1}<span class="blank">＿＿＿</span>{/if}
								{/each}
							</h2>

							{#if item.question?.promptEn}
								<p class="q-prompt-en readable">{item.question.promptEn}</p>
							{/if}

							<div class="answers-grid">
								<!-- Player's Answer -->
								<div
									class="answer-box"
									class:box-wrong={!item.isCorrect}
									class:card-correct={item.isCorrect}
								>
									<div class="ans-header hud">
										<span>YOUR ANSWER</span>
										<span class="ans-mark">{item.isCorrect ? '○' : '✕'}</span>
									</div>
									<p class="ans-body readable">
										{#if item.timedOut}
											<span class="dim-text">TIME UP (NO ANSWER)</span>
										{:else if item.selectedChoice}
											{item.selectedChoice.body}
										{:else}
											<span class="dim-text">NO ANSWER</span>
										{/if}
									</p>
								</div>

								<!-- Correct Answer -->
								<div class="answer-box box-correct">
									<div class="ans-header hud glow-green">
										<span>CORRECT ANSWER</span>
										<span class="ans-mark">○</span>
									</div>
									<p class="ans-body readable glow-green">
										{item.correctChoice?.body ?? '—'}
									</p>
								</div>
							</div>

							{#if item.question?.explanation}
								<div class="explanation">
									<p class="exp-title hud glow-beam">EXPLANATION / 解説</p>
									<p class="exp-body readable">{item.question.explanation}</p>
								</div>
							{/if}
						</article>
					{/each}
				</div>

				<footer class="actions">
					<a class="cta hud" href={resolve('/play')} onclick={resetActiveRun}>CONTINUE?</a>
					<a class="cta ghost hud" href={resolve('/ranking')}>RANKING</a>
					<a class="back hud" href={resolve('/')}>← TITLE</a>
				</footer>
			{/if}
		</div>
	</main>
</div>

<style>
	.review {
		--pad: clamp(16px, 3.4vw, 40px);
		height: min(760px, calc(100dvh - 56px));
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
		--y-pad: clamp(16px, 2.5vh, 28px);
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		gap: clamp(12px, 1.8vh, 18px);
		padding: var(--y-pad) var(--pad) calc(var(--y-pad) + 12px);
		text-align: center;
		overflow-y: auto;
		scrollbar-width: none;
		-ms-overflow-style: none;
	}

	.body::-webkit-scrollbar {
		display: none;
	}

	.state.empty {
		margin: auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}

	.summary-card {
		display: flex;
		align-items: center;
		justify-content: space-around;
		width: min(780px, 100%);
		background: rgb(17 22 41 / 0.7);
		border: var(--rule) solid #263053;
		border-radius: 4px;
		padding: 10px 16px;
	}

	.summary-stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}

	.stat-label {
		color: var(--dim);
		font-size: 11px;
		letter-spacing: 0.14em;
	}

	.stat-value {
		font-size: clamp(1.1rem, 2.5vw, 1.5rem);
		line-height: 1.1;
	}

	.summary-divider {
		width: var(--rule);
		height: 28px;
		background: #1c2340;
	}

	.filters {
		display: flex;
		gap: 8px;
	}

	.filter {
		padding: 6px 14px;
		background: transparent;
		border: var(--rule) solid #263053;
		color: var(--dim);
		font-family: var(--font-dot);
		font-size: 11px;
		letter-spacing: 0.14em;
		cursor: pointer;
		transition:
			border-color 120ms ease-out,
			color 120ms ease-out;
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

	.question-list {
		width: min(780px, 100%);
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.q-card {
		background: rgb(10 13 26 / 0.85);
		border: var(--rule) solid #1c2340;
		border-radius: 4px;
		padding: 14px 18px;
		text-align: start;
		display: flex;
		flex-direction: column;
		gap: 10px;
		box-shadow: 0 4px 16px rgb(0 0 0 / 0.3);
		transition: border-color 120ms ease-out;
	}

	.q-card.card-wrong {
		border-color: rgb(255 59 20 / 0.45);
		background: radial-gradient(
			circle at 100% 0%,
			rgb(255 59 20 / 0.06) 0%,
			rgb(10 13 26 / 0.9) 60%
		);
	}

	.q-card.card-correct {
		border-color: rgb(59 232 107 / 0.3);
		background: radial-gradient(
			circle at 100% 0%,
			rgb(59 232 107 / 0.04) 0%,
			rgb(10 13 26 / 0.9) 60%
		);
	}

	.q-card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 11px;
		letter-spacing: 0.14em;
		border-bottom: 1px solid #1c2340;
		padding-bottom: 6px;
	}

	.q-meta {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.q-level,
	.q-topic {
		color: var(--dim);
	}

	.dot {
		color: var(--dim);
	}

	.badge {
		padding: 2px 8px;
		font-size: 10px;
		letter-spacing: 0.12em;
		border: 1px solid currentColor;
		border-radius: 2px;
	}

	.badge.wrong,
	.badge.time-up {
		background: rgb(255 59 20 / 0.1);
	}

	.badge.correct {
		background: rgb(59 232 107 / 0.1);
	}

	.q-prompt {
		margin: 0;
		font-size: clamp(1rem, 2.2vw, 1.25rem);
		line-height: 1.45;
		color: var(--beam);
	}

	.blank {
		color: var(--gold);
		font-weight: 700;
		text-decoration: underline;
		text-underline-offset: 4px;
	}

	.q-prompt-en {
		margin: 0;
		color: var(--dim);
		font-size: 0.85rem;
		line-height: 1.4;
	}

	.answers-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		margin-top: 4px;
	}

	@media (max-width: 580px) {
		.answers-grid {
			grid-template-columns: 1fr;
		}
	}

	.answer-box {
		padding: 8px 12px;
		border-radius: 3px;
		background: rgb(17 22 41 / 0.6);
		border: 1px solid #263053;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.answer-box.box-wrong {
		border-color: rgb(255 59 20 / 0.5);
		background: rgb(255 59 20 / 0.08);
	}

	.answer-box.box-correct {
		border-color: rgb(59 232 107 / 0.5);
		background: rgb(59 232 107 / 0.08);
	}

	.ans-header {
		display: flex;
		justify-content: space-between;
		font-size: 10px;
		letter-spacing: 0.12em;
		color: var(--dim);
	}

	.box-wrong .ans-header {
		color: var(--red);
	}

	.ans-body {
		margin: 0;
		font-size: 0.95rem;
		color: var(--beam);
		font-weight: 500;
	}

	.box-wrong .ans-body {
		color: #ff8c7a;
	}

	.dim-text {
		color: var(--dim);
		font-style: italic;
	}

	.explanation {
		background: rgb(43 92 255 / 0.08);
		border-left: 3px solid var(--blue);
		padding: 8px 12px;
		border-radius: 0 4px 4px 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 4px;
	}

	.exp-title {
		margin: 0;
		font-size: 10px;
		letter-spacing: 0.14em;
	}

	.exp-body {
		margin: 0;
		font-size: 0.88rem;
		line-height: 1.5;
		color: var(--beam);
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
		justify-content: center;
		padding-top: 8px;
	}

	.cta {
		padding: 12px 26px;
		background: transparent;
		border: var(--rule) solid var(--gold);
		color: var(--gold);
		font-family: var(--font-dot);
		font-size: clamp(0.85rem, 2.6vw, 1.05rem);
		letter-spacing: 0.2em;
		text-indent: 0.2em;
		text-decoration: none;
		cursor: pointer;
		transition:
			background 140ms ease-out,
			color 140ms ease-out;
	}

	.cta:hover,
	.cta:focus-visible {
		background: var(--gold);
		color: var(--void);
	}

	.cta.ghost {
		border-color: var(--blue);
		color: var(--beam);
	}

	.cta.ghost:hover,
	.cta.ghost:focus-visible {
		background: var(--blue);
		color: var(--beam);
	}

	.back {
		color: var(--dim);
		text-decoration: none;
		font-size: 11px;
		letter-spacing: 0.16em;
	}

	.back:hover,
	.back:focus-visible {
		color: var(--beam);
	}
</style>
