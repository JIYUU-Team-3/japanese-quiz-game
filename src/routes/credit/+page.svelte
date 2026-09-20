<script lang="ts">
	import { resolve } from '$app/paths'
	import { onMount } from 'svelte'

	// In the order the team gave them, family name first.
	const members = [
		{
			name: 'TITH SATHYA',
			ja: 'ティツ・サティヤ',
			role: 'QUESTION DATA',
			work: ['JIYUU Founder', 'Questions Creator', 'Answers Creator', 'Domain Organizer'],
		},
		{
			name: 'NUON UTEYTITHYA',
			ja: 'ヌオン・ウテイティシャ',
			role: 'DATABASE & CI/CD',
			work: [
				'Database schema design',
				'CI/CD Setup',
				'SonarCloud Setup',
				'Repository Setup',
				'CSpell Configuration',
				'Lefthook Configuration',
				'Configure observability in Cloudflare',
				'Deployment Setup',
			],
		},
		{
			name: 'HOUT MANUT',
			ja: 'ホーウト・マーヌット',
			role: 'BACKEND',
			work: ['Visual quality assurance', 'Database documentation'],
		},
		{
			name: 'CHENG PORCHHENG',
			ja: 'チェン・ポーチェン',
			role: 'FRONTEND',
			work: ['Quiz page', 'Ranking page', 'Credit page'],
		},
		{
			name: 'SAO VISAL',
			ja: 'サオ・ヴィサル',
			role: 'QUALITY ASSURANCE',
			work: [
				'Visual quality assurance',
				'End-to-end tests with Playwright',
				'Unit tests with Vitest',
			],
		},
	]

	/**
	 * Seconds any one line spends crossing the tube on its own. It is set for
	 * reading on the first pass, and the speed is taken from the tube's height,
	 * so it holds on a phone and a desktop alike and a longer list only makes the
	 * loop longer.
	 */
	const CROSSING_S = 20

	/** How long the roll holds after the player's last scroll before it moves again. */
	const RESUME_MS = 2000

	let tube: HTMLDivElement
	let tubeHeight = $state(0)

	// The tube is a real scroller that this loop advances, so the player can take
	// it over at any moment by wheel, touch, scrollbar, or keys, and the roll
	// carries on from wherever they leave it.
	onMount(() => {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

		let pos = tube.scrollTop
		// Where this loop last put the tube. A scroll that lands anywhere else was the player's.
		let placed = tube.scrollTop
		let held = false
		let lastInput = -Infinity
		let last = performance.now()

		const takeOver = () => (lastInput = performance.now())
		const press = () => {
			held = true
			takeOver()
		}
		const release = () => {
			if (!held) return
			held = false
			takeOver()
		}
		const onScroll = () => {
			if (Math.abs(tube.scrollTop - placed) > 2) takeOver()
		}

		let frame = requestAnimationFrame(function step(now) {
			// Capped so a tab brought back from the background does not leap ahead.
			const dt = Math.min(now - last, 100)
			last = now

			if (held || now - lastInput < RESUME_MS) {
				pos = tube.scrollTop
			} else {
				pos += (tube.clientHeight / CROSSING_S) * (dt / 1000)
				// The last line has completely scrolled past the top and only the empty
				// tail was visible, so loop back to 0 where the title enters from the bottom.
				if (pos >= tube.scrollHeight - tube.clientHeight) pos = 0
				tube.scrollTop = pos
			}
			placed = tube.scrollTop
			frame = requestAnimationFrame(step)
		})

		tube.addEventListener('scroll', onScroll, { passive: true })
		tube.addEventListener('wheel', takeOver, { passive: true })
		tube.addEventListener('keydown', takeOver)
		tube.addEventListener('pointerdown', press)
		window.addEventListener('pointerup', release)
		window.addEventListener('pointercancel', release)

		return () => {
			cancelAnimationFrame(frame)
			tube.removeEventListener('scroll', onScroll)
			tube.removeEventListener('wheel', takeOver)
			tube.removeEventListener('keydown', takeOver)
			tube.removeEventListener('pointerdown', press)
			window.removeEventListener('pointerup', release)
			window.removeEventListener('pointercancel', release)
		}
	})
</script>

<svelte:head><title>MEMBERS — 日本語アタック</title></svelte:head>

<div class="cabinet">
	<main class="screen members">
		<header class="bar hud">
			<a class="back" href={resolve('/')} aria-label="Title screen">←</a>
			<span class="glow-beam">MEMBER CONTRIBUTIONS</span>
		</header>

		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			class="tube"
			role="region"
			aria-label="Member contributions"
			tabindex="0"
			bind:this={tube}
			bind:clientHeight={tubeHeight}
		>
			<div class="roll" style:--tube-height={tubeHeight > 0 ? `${tubeHeight}px` : '100svh'}>
				<div class="blank" aria-hidden="true"></div>

				<h1 class="title">
					<span class="title-ja glow-beam">日本語アタック</span>
					<span class="title-en">NIHONGO ATTACK</span>
					<span class="team hud glow-gold">JIYUU-TEAM-3</span>
				</h1>

				{#each members as member (member.name)}
					<section class="member" aria-label={member.name}>
						<h2 class="name hud">{member.name}</h2>
						<p class="name-ja readable" lang="ja">{member.ja}</p>
						<p class="role hud glow-beam">{member.role}</p>
						<ul class="work readable">
							{#each member.work as item (item)}
								<li>{item}</li>
							{/each}
						</ul>
					</section>
				{/each}

				<section class="closing" aria-label="Closing message">
					<p class="thanks-ja hud glow-gold">ありがとうございます！</p>
				</section>

				<div class="blank" aria-hidden="true"></div>
			</div>
		</div>
	</main>
</div>

<style>
	.members {
		--pad: clamp(16px, 3.4vw, 40px);
	}

	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 14px var(--pad);
		border-bottom: var(--rule) solid #1c2340;
		font-size: clamp(11px, 1.5vw, 14px);
		letter-spacing: 0.16em;
	}
	.back {
		color: var(--dim);
		text-decoration: none;
		white-space: nowrap;
		line-height: 1;
	}
	.back:hover,
	.back:focus-visible {
		color: var(--beam);
	}

	/*
	 * The roll climbs inside this and is cut off at its edges, as on a cabinet.
	 * It is a real scroller, so the player can move the roll by hand as well.
	 */
	.tube {
		position: relative;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		container-type: size;
	}
	.tube:focus-visible {
		outline: var(--rule) solid var(--blue);
		outline-offset: -4px;
	}

	.roll {
		--roll-gap: clamp(48px, 9vw, 88px);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--roll-gap);
		padding: 0 var(--pad);
		text-align: center;
	}

	/*
	 * An empty spacer before and after the credits, scaled to the tube height
	 * minus the flex gap. The first holds the opening line flush against the
	 * bottom edge of the tube when the page opens; the second allows the last
	 * line to climb completely off the top before the roll loops back to the
	 * beginning.
	 */
	.blank {
		flex: none;
		height: calc(var(--tube-height) - var(--roll-gap));
	}

	.title {
		margin: 0;
		display: grid;
		gap: 8px;
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
	.team {
		margin-top: 18px;
		font-size: clamp(0.8rem, 2.4vw, 0.95rem);
		letter-spacing: 0.3em;
		text-indent: 0.3em;
	}

	/* Name first and brightest, its katakana reading, the role, then what they built. */
	.member {
		width: min(520px, 100%);
		display: grid;
		gap: 8px;
	}
	.name {
		margin: 0;
		font-size: clamp(1.1rem, 3.6vw, 1.5rem);
		font-weight: inherit;
		letter-spacing: 0.12em;
		text-indent: 0.12em;
		color: var(--gold);
		text-shadow: var(--bloom) rgb(255 196 0 / 0.4);
	}
	.name-ja {
		margin: -4px 0 2px;
		font-size: clamp(0.8rem, 2.3vw, 0.95rem);
		letter-spacing: 0.1em;
		color: var(--beam);
	}
	.role {
		margin: 0;
		font-size: clamp(0.66rem, 1.8vw, 0.78rem);
		letter-spacing: 0.26em;
		text-indent: 0.26em;
	}
	.work {
		list-style: none;
		margin: 6px 0 0;
		padding: 0;
		display: grid;
		gap: 4px;
		color: var(--dim);
		font-size: clamp(0.8rem, 2.3vw, 0.92rem);
		line-height: 1.6;
	}

	.closing {
		display: grid;
		gap: 8px;
		margin-top: 12px;
	}
	.thanks-ja {
		margin: 0;
		font-size: clamp(1.6rem, 5.5vw, 2.4rem);
		letter-spacing: 0.12em;
	}

	/*
	 * The script never starts the loop here, so the roll is a plain list the
	 * player scrolls, with no empty tube at either end.
	 */
	@media (prefers-reduced-motion: reduce) {
		.roll {
			padding-block: clamp(30px, 6vw, 60px);
		}
		.blank {
			display: none;
		}
	}
</style>
