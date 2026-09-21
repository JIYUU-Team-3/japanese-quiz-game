import { expect, test, type Page, type APIRequestContext } from '@playwright/test'
import { open } from './cabinet.js'

/**
 * The whole loop, over the real backend: title → course → run → name → board.
 *
 * These tests hit a live D1 (locally, the SQLite file under `.wrangler/state`
 * seeded by `pnpm db:reset:local`), so they fail if the API routes, the schema,
 * or the seed are out of step with each other — which is the point. They assume
 * a development database, not a busy one: the ranking assertions expect a run of
 * a few hundred points to reach a top-ten board.
 */

interface ApiQuestion {
	prompt: string
	choices: { body: string; isCorrect: boolean }[]
}

/** Maps a question's prompt to its correct answer, read from the same API the game uses. */
async function answerKey(request: APIRequestContext, level: string): Promise<Map<string, string>> {
	const response = await request.get(`/api/questions?level=${level}`)
	expect(response.ok()).toBeTruthy()
	const questions = (await response.json()) as ApiQuestion[]
	expect(questions.length).toBeGreaterThan(0)

	return new Map(
		questions.map((q) => {
			const correct = q.choices.find((c) => c.isCorrect)
			expect(correct, `question "${q.prompt}" has no correct choice`).toBeDefined()
			return [q.prompt, correct!.body]
		}),
	)
}

/**
 * Answers the question on screen, then presses NEXT to leave the feedback pause.
 *
 * The choices are reshuffled per question, so the right button is found by its
 * text at the moment of the click rather than by position.
 */
async function answer(page: Page, key: Map<string, string>, correctly: boolean) {
	const choices = page.locator('button.choice')
	await expect(choices.first()).toBeEnabled()

	const prompt = (await page.locator('section.round h1').innerText()).trim()
	const wanted = key.get(prompt)
	expect(wanted, `prompt "${prompt}" is not in the served bank`).toBeDefined()

	const count = await choices.count()
	for (let i = 0; i < count; i++) {
		const body = (await choices.nth(i).locator('.text').innerText()).trim()
		if ((body === wanted) === correctly) {
			await choices.nth(i).click({ force: true })
			const nextBtn = page.locator('button.next')
			await expect(nextBtn).toBeEnabled({ timeout: 5000 })
			await nextBtn.click({ force: true })
			await expect(page.locator('button.next')).toHaveCount(0)
			return
		}
	}
	throw new Error(`no ${correctly ? 'correct' : 'incorrect'} choice found for "${prompt}"`)
}

test('the attract screen is rendered by the server, not fetched by the browser', async ({
	page,
}) => {
	// JavaScript is irrelevant here: the point is that the first response already
	// carries the board and a demo question.
	const response = await open(page, '/')
	const html = (await response!.text()).replace(/\s+/g, ' ')

	expect(html).toContain('NIHONGO ATTACK')
	expect(html).toContain('DEMO PLAY')
	expect(html).toContain('HI-SCORE')
	expect(html).not.toContain('LOADING…')
})

/*
 * The only test here that writes. It is tagged so the post-deploy run can skip
 * it — verifying a deployment must not leave a row on the real leaderboard.
 */
test(
	'a run is graded by the server and lands on the ranking',
	{ tag: '@writes' },
	async ({ page, request }) => {
		const key = await answerKey(request, 'N4')
		const name = `T${String(Date.now()).slice(-5)}`

		await open(page, '/')
		await page.getByRole('link', { name: 'PUSH START' }).click()

		await expect(page.getByRole('heading', { name: 'SELECT COURSE' })).toBeVisible()
		const n4 = page.getByRole('button').filter({ hasText: 'N4' })
		await expect(n4).toContainText('QUESTIONS')
		await n4.click()

		// Three right, then three wrong: a real score, then the third life spent.
		for (let i = 0; i < 3; i++) await answer(page, key, true)
		await expect(page.locator('.hud-bar')).toContainText('×2')
		for (let i = 0; i < 3; i++) await answer(page, key, false)

		await expect(page.getByRole('heading', { name: 'GAME OVER' })).toBeVisible()
		await expect(page.getByRole('heading', { name: /RANK IN/ })).toBeVisible()

		await page.getByRole('textbox').fill(name)
		await page.getByRole('button', { name: 'ENTER' }).click()

		await expect(page.locator('.ranked')).toContainText('ENTRY RECORDED')

		// The score shown on GAME OVER is the score the server recorded, so no
		// "SERVER SCORE" correction should appear.
		await expect(page.locator('.regraded')).toHaveCount(0)

		await page.getByRole('link', { name: 'VIEW RANKING' }).click()
		await expect(page.locator('.table')).toContainText(name)
		await expect(page.locator('.table')).toContainText('N4')
	},
)

test('the ranking filters by course on the server', async ({ page }) => {
	await open(page, '/ranking')
	await page.getByRole('button', { name: 'N3', exact: true }).click()

	const board = page.locator('.table .row:not(.header-row)')
	// Whatever N3 rows exist, none of them may be from another course.
	for (let i = 0; i < (await board.count()); i++) {
		await expect(board.nth(i).locator('.lv')).toHaveText('N3')
	}
})

test('a forged score is refused rather than recorded', async ({ request }) => {
	// Question 16 is N3. Claiming it under N4 would put an N3 item on the N4
	// board, and Level is a promise.
	const response = await request.post('/api/sessions', {
		data: {
			playerName: 'FORGE',
			level: 'N4',
			durationMs: 1000,
			score: 999999,
			answers: [{ questionId: 16, choiceId: 49, answerMs: 0 }],
		},
	})

	expect(response.status()).toBe(422)
})
