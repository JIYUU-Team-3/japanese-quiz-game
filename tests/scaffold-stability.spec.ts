import { expect, test, type Page, type APIRequestContext } from '@playwright/test'
import { open } from './cabinet.js'

/**
 * The cabinet must not wobble.
 *
 * Every screen is `.cabinet > main.screen > header`, and the HUD is rendered in
 * every phase "so the machine never loses its frame". This file holds that
 * frame to its word: as the content underneath changes — a phase swap, a longer
 * question, a filtered board — the screen and its header must stay exactly
 * where they were, to the pixel, at desktop *and* at iPhone SE.
 *
 * Strictly read-only: it plays runs but never presses ENTER, so nothing is ever
 * posted to /api/sessions. (Dev binds D1 with `remote: true`.)
 */

const VIEWPORTS = [
	{ label: 'desktop', width: 1280, height: 720 },
	{ label: 'iphone-se', width: 375, height: 667 },
] as const

interface Box {
	x: number
	y: number
	w: number
	h: number
}
interface Chrome {
	screen: Box | null
	header: Box | null
	/** How far the document is wider than the viewport: > 0 means sideways scroll. */
	overflowPx: number
}

/**
 * The scaffold's geometry, in document coordinates.
 *
 * Document rather than viewport coordinates, and scrolled to the top first, so
 * that a page which merely scrolls is not mistaken for a page which shifts.
 */
async function chrome(page: Page): Promise<Chrome> {
	await page.evaluate(() => window.scrollTo(0, 0))
	// Two frames: one for the layout, one for anything that reacts to it.
	await page.evaluate(
		() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
	)
	return page.evaluate(() => {
		const r1 = (n: number) => Math.round(n * 10) / 10
		const box = (selector: string): Box | null => {
			const el = document.querySelector(selector)
			if (!el) return null
			const r = el.getBoundingClientRect()
			return {
				x: r1(r.x + window.scrollX),
				y: r1(r.y + window.scrollY),
				w: r1(r.width),
				h: r1(r.height),
			}
		}
		return {
			screen: box('main.screen'),
			header: box('main.screen > header'),
			overflowPx: r1(document.documentElement.scrollWidth - window.innerWidth),
		}
	})
}

/** Renders a reading for the failure message, so a red run says what moved. */
function show(label: string, c: Chrome): string {
	const f = (b: Box | null) => (b ? `x=${b.x} y=${b.y} w=${b.w} h=${b.h}` : 'ABSENT')
	return `  ${label.padEnd(22)} screen[${f(c.screen)}]  header[${f(c.header)}]`
}

/**
 * Asserts every reading has the same geometry as the first.
 *
 * The whole point of the bug is drift *across* content changes, so the readings
 * are compared as a set rather than pairwise — the message then shows the whole
 * sequence, which is how you see which state is the odd one out.
 */
function expectNoDrift(readings: { label: string; chrome: Chrome }[]) {
	const [first, ...rest] = readings
	const report = readings.map((r) => show(r.label, r.chrome)).join('\n')
	for (const r of rest) {
		expect(
			r.chrome.header,
			`header moved between "${first.label}" and "${r.label}"\n${report}`,
		).toEqual(first.chrome.header)
		expect(
			r.chrome.screen,
			`screen moved between "${first.label}" and "${r.label}"\n${report}`,
		).toEqual(first.chrome.screen)
	}
}

interface ApiQuestion {
	prompt: string
	choices: { body: string; isCorrect: boolean }[]
}

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

/** Answers the question on screen and leaves the feedback pause via NEXT. */
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

for (const vp of VIEWPORTS) {
	test.describe(vp.label, () => {
		test.use({ viewport: { width: vp.width, height: vp.height } })

		test('the play HUD holds still from SELECT COURSE through GAME OVER', async ({
			page,
			request,
		}) => {
			const key = await answerKey(request, 'N4')
			const readings: { label: string; chrome: Chrome }[] = []

			await open(page, '/play')
			await expect(page.getByRole('heading', { name: 'SELECT COURSE' })).toBeVisible()
			readings.push({ label: 'select', chrome: await chrome(page) })

			const n4 = page.getByRole('button').filter({ hasText: 'N4' })
			await expect(n4).toContainText('QUESTIONS')
			// The screen is server-rendered, so the button exists before its handler
			// does and a click can land on nothing. Retry until the run actually
			// starts, otherwise this reads as a layout failure on a fast machine.
			await expect(async () => {
				await n4.click()
				await expect(page.locator('section.round h1')).toBeVisible({ timeout: 2000 })
			}).toPass({ timeout: 20_000 })

			// Each question is a different length of prompt and of choices: this is
			// the content change the player sees the chrome move against.
			for (let i = 1; i <= 3; i++) {
				await expect(page.locator('section.round h1')).toBeVisible()
				readings.push({ label: `question ${i}`, chrome: await chrome(page) })
				await answer(page, key, i === 1)
			}

			// Two more misses ends the run (three lives), without ever submitting.
			await expect(page.locator('section.round h1')).toBeVisible()
			readings.push({ label: 'question 4', chrome: await chrome(page) })
			await answer(page, key, false)

			await expect(page.getByRole('heading', { name: 'GAME OVER' })).toBeVisible()
			readings.push({ label: 'game over', chrome: await chrome(page) })

			expectNoDrift(readings)
		})

		test('the ranking header holds still when the course filter changes the board', async ({
			page,
		}) => {
			const readings: { label: string; chrome: Chrome }[] = []

			// A course with no scores yet shows NO ENTRIES instead of the table, and
			// that swap is itself a content change the header has to survive — so
			// the wait is for the board to have *settled*, either way, rather than
			// for the table specifically.
			const settled = page.locator('.table, .state.empty')
			await open(page, '/ranking')
			await expect(settled.first()).toBeVisible()
			readings.push({ label: 'initial', chrome: await chrome(page) })

			for (const course of ['N3', 'N4']) {
				await page.getByRole('button', { name: course, exact: true }).click()
				await expect(page.locator('.state.hud', { hasText: 'LOADING' })).toHaveCount(0)
				await expect(settled.first()).toBeVisible()
				readings.push({ label: `filter ${course}`, chrome: await chrome(page) })
			}

			expectNoDrift(readings)
		})

		test('no screen scrolls sideways', async ({ page }) => {
			for (const path of ['/', '/play', '/ranking', '/credit', '/review']) {
				await open(page, path)
				await expect(page.locator('main.screen')).toBeVisible()
				const c = await chrome(page)
				expect(c.overflowPx, `${path} scrolls sideways by ${c.overflowPx}px`).toBeLessThanOrEqual(0)
			}
		})

		test('the cabinet screen dimensions are identical across all pages', async ({ page }) => {
			const paths = ['/', '/play', '/ranking', '/credit', '/review']
			const readings: { label: string; chrome: Chrome }[] = []
			for (const path of paths) {
				await open(page, path)
				await expect(page.locator('main.screen')).toBeVisible()
				readings.push({ label: path, chrome: await chrome(page) })
			}
			const first = readings[0]
			for (const r of readings.slice(1)) {
				expect(
					r.chrome.screen,
					`screen geometry differs between "${first.label}" and "${r.label}"`,
				).toEqual(first.chrome.screen)
			}
		})
	})
}
