import { test, expect, type Page } from '@playwright/test'

/**
 * The members roll is reached from the title screen's CREDIT readout. It scrolls
 * itself on a loop, and the player can scroll it by hand at any time. None of
 * these tests write anything.
 */

const TEAM = ['TITH SATHYA', 'NUON UTEYTITHYA', 'HOUT MANUT', 'CHENG PORCHHENG', 'SAO VISAL']

const scrollTop = (page: Page) => page.locator('.tube').evaluate((el) => el.scrollTop)

test('the CREDIT readout on the title screen reaches the members roll, and TITLE leads back', async ({
	page,
}) => {
	await page.goto('/')
	await expect(page.getByRole('link', { name: 'ABOUT', exact: true })).toHaveCount(0)
	await expect(page.getByRole('link', { name: 'MEMBERS', exact: true })).toHaveCount(0)
	await page.getByRole('link', { name: 'CREDIT', exact: true }).click()
	await expect(page).toHaveURL(/\/credit$/)
	for (const name of TEAM) {
		await expect(page.getByRole('heading', { name, exact: true })).toBeAttached()
	}

	await page.locator('header a.back').click()
	await expect(page).toHaveURL(/\/$/)
})

test('each member is listed with a role and what they built', async ({ page }) => {
	await page.goto('/credit')

	const cheng = page.getByRole('region', { name: 'CHENG PORCHHENG' })
	await expect(cheng.getByText('チェン・ポーチェン', { exact: true })).toBeAttached()
	await expect(cheng.getByText('FRONTEND', { exact: true })).toBeAttached()
	await expect(cheng.getByRole('listitem')).toHaveText(['Quiz page', 'Ranking page', 'Credit page'])
})

test('the roll enters from the bottom of the tube and climbs', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'no-preference' })
	await page.goto('/credit')

	const tube = await page.locator('.tube').boundingBox()
	const title = page.getByRole('heading', { name: /NIHONGO ATTACK/ })
	const start = await title.boundingBox()

	// A line takes 20s to cross, so the title is still in the lower half this early.
	expect(start!.y).toBeGreaterThan(tube!.y + tube!.height / 2)
	await expect.poll(async () => (await title.boundingBox())!.y).toBeLessThan(start!.y)
})

test('the player can scroll the roll by hand, and it carries on by itself afterwards', async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: 'no-preference' })
	await page.goto('/credit')
	await expect.poll(() => scrollTop(page)).toBeGreaterThan(0)

	const tube = (await page.locator('.tube').boundingBox())!
	await page.mouse.move(tube.x + tube.width / 2, tube.y + tube.height / 2)
	const before = await scrollTop(page)
	await page.mouse.wheel(0, 900)
	// Far more than the loop could cover on its own in the same moment.
	await expect.poll(() => scrollTop(page)).toBeGreaterThan(before + 600)

	const handed = await scrollTop(page)
	await expect.poll(() => scrollTop(page), { timeout: 8_000 }).toBeGreaterThan(handed + 10)
})

test('with reduced motion the roll stands still and every name can be scrolled to', async ({
	page,
}) => {
	// emulateMedia rather than test.use({ reducedMotion }): the fixture option did
	// not reach matchMedia in any of the three browsers.
	await page.emulateMedia({ reducedMotion: 'reduce' })
	await page.goto('/credit')

	await page.waitForTimeout(1_000)
	expect(await scrollTop(page)).toBe(0)
	for (const name of TEAM) {
		const line = page.getByRole('heading', { name, exact: true })
		await line.scrollIntoViewIfNeeded()
		await expect(line).toBeInViewport()
	}
})
