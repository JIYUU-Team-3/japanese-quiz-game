import { test, expect } from '@playwright/test'

test('home page renders', async ({ page }) => {
	const response = await page.goto('/')

	expect(response?.ok()).toBe(true)
	await expect(page.getByRole('heading', { name: 'Welcome to SvelteKit' })).toBeVisible()
})

test('serves the SvelteKit app shell', async ({ page }) => {
	await page.goto('/')

	await expect(page.locator('html')).toHaveAttribute('lang', /.+/)
})
