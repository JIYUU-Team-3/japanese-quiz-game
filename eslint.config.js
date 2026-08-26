import prettier from 'eslint-config-prettier'
import path from 'node:path'
import js from '@eslint/js'
import svelte from 'eslint-plugin-svelte'
import { defineConfig, includeIgnoreFile } from 'eslint/config'
import globals from 'globals'
import ts from 'typescript-eslint'

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore')

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off',
		},
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
			},
		},
	},
	{
		// Naming rules apply to hand-written app source only. Deliberately scoped
		// to `src`, which excludes:
		//   - build config at the root (vite/playwright/drizzle/eslint configs)
		//   - worker-configuration.d.ts and src/lib/paraglide, both generated
		//   - tests/, whose specs follow Playwright's own conventions
		// This also means the type-aware parser only needs tsconfig's `include`,
		// which already covers `src` — no allowDefaultProject workaround needed.
		files: ['src/**/*.ts', 'src/**/*.svelte'],
		languageOptions: {
			parserOptions: {
				// naming-convention requires type information.
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			'@typescript-eslint/naming-convention': [
				'error',
				// Anything not matched by a more specific selector below.
				{
					selector: 'default',
					format: ['camelCase'],
					leadingUnderscore: 'allow',
					trailingUnderscore: 'allow',
				},
				// Module-level constants are conventionally SCREAMING_CASE, and
				// imported components are PascalCase.
				{
					selector: 'variable',
					format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
					leadingUnderscore: 'allow',
				},
				{ selector: 'import', format: ['camelCase', 'PascalCase'] },
				{ selector: 'typeLike', format: ['PascalCase'] },
				{ selector: 'enumMember', format: ['PascalCase', 'UPPER_CASE'] },

				// SvelteKit's +server.ts route handlers are exported under the HTTP
				// verb — `export function GET(...)`. The framework matches on that
				// name, so it is not ours to rename.
				{
					selector: 'function',
					modifiers: ['exported'],
					format: ['camelCase', 'UPPER_CASE'],
				},

				// --- Exemptions: names we don't get to choose ---

				// Destructuring an external payload. `const { access_token } = await
				// res.json()` shouldn't force a rename at the boundary.
				{ selector: 'variable', modifiers: ['destructured'], format: null },

				// Keys that cannot be written as bare identifiers — 'x-api-key',
				// 'Content-Type', 'some.dotted.key'. Note this does NOT cover
				// merely-quoted keys like 'snake_case', where the quotes are
				// optional; those still error.
				{
					selector: [
						'objectLiteralProperty',
						'typeProperty',
						'classProperty',
						'objectLiteralMethod',
					],
					format: null,
					modifiers: ['requiresQuotes'],
				},

				// snake_case is allowed on runtime data keys only — API payloads,
				// D1/SQL column names, env-shaped config. These are values crossing
				// a boundary, so matching the other side is correct.
				//
				// Deliberately NOT extended to `typeProperty`: interfaces and type
				// aliases are TypeScript's own surface, and stay camelCase so the
				// exemption can't leak into hand-written domain types.
				{
					selector: 'objectLiteralProperty',
					format: ['camelCase', 'snake_case', 'UPPER_CASE'],
					leadingUnderscore: 'allow',
				},
			],
		},
	},
	{
		// Override or add rule settings here, such as:
		// 'svelte/button-has-type': 'error'
		rules: {},
	},
)
