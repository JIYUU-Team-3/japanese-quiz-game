import { expect, test } from '@playwright/test'

/**
 * The boot screen: a gate that waits for the player's first press, because
 * that press is what lets the cabinet make a sound, and then a load that
 * lifts on its own. Read-only.
 */

test('the gate waits for a press and keeps the cabinet out of reach until then', async ({
	page,
}) => {
	await page.goto('/')
	const gate = page.getByRole('button', { name: 'PRESS ANY BUTTON' })
	await expect(gate).toBeVisible()

	// Long enough that anything which lifts on its own — a load, a floor, a
	// ceiling — would already have lifted it.
	await page.waitForTimeout(3_000)
	await expect(page.locator('#boot-screen')).toHaveCount(1)
	await expect(gate).toBeVisible()
	const reachable = await page.evaluate(() => {
		const start = document.querySelector<HTMLElement>('.start')
		start?.focus()
		return document.activeElement === start
	})
	expect(reachable, 'PUSH START took focus through the gate').toBe(false)
})

for (const key of ['Enter', 'a']) {
	test(`any key is a press — ${key}`, async ({ page }) => {
		await page.goto('/')
		await expect(page.getByRole('button', { name: 'PRESS ANY BUTTON' })).toBeVisible()
		await page.keyboard.press(key)
		await expect(page.locator('#boot-screen')).toHaveCount(0, { timeout: 15_000 })
		await page.getByRole('link', { name: 'PUSH START' }).click()
		await expect(page).toHaveURL(/\/play$/)
	})
}

test('a tap anywhere on the gate is a press, not only on its words', async ({ page }) => {
	await page.goto('/')
	await expect(page.getByRole('button', { name: 'PRESS ANY BUTTON' })).toBeVisible()
	await page.mouse.click(12, 12)
	await expect(page.locator('#boot-screen')).toHaveCount(0, { timeout: 15_000 })
})

test('a browser shortcut is not a press', async ({ page }) => {
	await page.goto('/')
	await expect(page.getByRole('button', { name: 'PRESS ANY BUTTON' })).toBeVisible()
	await page.keyboard.press('Escape')
	await page.keyboard.press('Tab')
	await page.waitForTimeout(1_000)
	await expect(page.locator('#boot-screen')).toHaveCount(1)
})
