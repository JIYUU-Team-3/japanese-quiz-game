import { expect, type Page, type Response } from '@playwright/test'

/**
 * Arrives at a screen the way a player does.
 *
 * `page.goto` comes back as soon as the document is there, but the cabinet is
 * behind its boot screen for a moment after that — covered by an overlay, and
 * `inert` underneath it, so nothing on the screen can be reached yet.
 *
 * Playwright's actionability checks already wait that out for anything that
 * *acts* on an element: a click retries until the overlay stops intercepting
 * it. Two kinds of test are not covered by that and need this instead:
 *
 *   - raw input, `page.mouse.wheel` above all, which is dispatched at a point
 *     on the screen with no actionability check at all and so lands on the
 *     boot screen rather than on what is behind it;
 *   - anything that *measures* instead of acting — a bounding box, a scroll
 *     offset, a computed size — which reads a screen the player cannot touch
 *     yet and returns a number that is true of nothing they will ever see.
 *
 * ⚠ Use this rather than `page.goto` for every landing in this suite. It is
 * cheap where it is not needed, and the failure it prevents is a flake that
 * only shows up when the machine running the tests is slow.
 */
export async function open(page: Page, path: string): Promise<Response | null> {
	const response = await page.goto(path)
	// Generous, because this waits on the real network: the boot screen holds
	// for the two typefaces and the screen's music track, and its own ceiling
	// lets go at eight seconds regardless.
	await expect(page.locator('#boot-screen')).toHaveCount(0, { timeout: 15_000 })
	return response
}
