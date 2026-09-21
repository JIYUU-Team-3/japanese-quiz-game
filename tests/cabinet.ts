import { expect, type Page, type Response } from '@playwright/test'

/**
 * Arrives at a screen the way a player does: press the gate, wait for the
 * cabinet to come up.
 *
 * `page.goto` comes back as soon as the document is there, but the cabinet is
 * behind its boot screen after that — first a PRESS ANY BUTTON gate that waits
 * on the player indefinitely, then a loading bar if anything is still loading.
 * Until both are gone the screen is covered, and `inert` underneath, so
 * nothing on it can be reached.
 *
 * Nothing but a press lifts the gate, so every landing needs this: a test that
 * goes straight to a click would wait out its whole timeout against an overlay
 * that is never going to leave. And once past the gate, two kinds of test
 * still need the load waited out rather than left to Playwright's
 * actionability checks, which only wait on things that *act*:
 *
 *   - raw input, `page.mouse.wheel` above all, which is dispatched at a point
 *     on the screen with no actionability check at all and so lands on the
 *     boot screen rather than on what is behind it;
 *   - anything that *measures* instead of acting — a bounding box, a scroll
 *     offset, a computed size — which reads a screen the player cannot touch
 *     yet and returns a number that is true of nothing they will ever see.
 *
 * ⚠ Use this rather than `page.goto` for every landing in this suite.
 */
export async function open(page: Page, path: string): Promise<Response | null> {
	const response = await page.goto(path)
	// The prompt only appears once the page has hydrated, so this also waits
	// out the moment where a press would have gone nowhere.
	await page.getByRole('button', { name: 'PRESS ANY BUTTON' }).click()
	// Generous, because this waits on the real network: the load holds for the
	// two typefaces and the screen's music track, and its own ceiling lets go
	// at eight seconds after the press regardless.
	await expect(page.locator('#boot-screen')).toHaveCount(0, { timeout: 15_000 })
	return response
}
