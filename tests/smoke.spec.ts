import { test, expect } from '@playwright/test'
import { open } from './cabinet.js'

/**
 * The cheapest possible "is it alive" pair, kept separate from the game loop so
 * it can also be pointed at a deployment (see PLAYWRIGHT_BASE_URL in
 * playwright.config.ts). Neither test writes anything.
 */

test('home page renders', async ({ page }) => {
	const response = await open(page, '/')

	expect(response?.ok()).toBe(true)
	await expect(page.getByRole('heading', { name: /NIHONGO ATTACK/ })).toBeVisible()
})

test('serves the SvelteKit app shell', async ({ page }) => {
	await open(page, '/')

	await expect(page.locator('html')).toHaveAttribute('lang', /.+/)
})
