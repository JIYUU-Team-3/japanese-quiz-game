/**
 * Emits `drizzle/seed.sql` from the authored question set.
 *
 * The bank lives in `src/lib/game/official-data.ts` as typed TypeScript rather than
 * as loose SQL, so it is checked by the same compiler as the rest of the game
 * and cannot drift out of the `Question` shape. This script is the one place
 * that turns it into rows.
 *
 * Written to be re-runnable: the seed deletes the rows it owns and reinserts
 * them with fixed ids, so applying it twice leaves the same database. It never
 * touches `players`, `sessions` or `session_answers` — those are play data, and
 * re-seeding content must not erase a leaderboard.
 *
 *   node --experimental-strip-types scripts/generate-seed.ts > drizzle/seed.sql
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { OFFICIAL_QUESTIONS, TOPICS } from '../src/lib/game/official-data.ts'

/** SQLite string literal: single quotes doubled, nothing else escaped. */
function lit(value: string | null): string {
	return value === null ? 'NULL' : `'${value.replace(/'/g, "''")}'`
}

const lines: string[] = [
	'-- GENERATED FILE — do not edit by hand.',
	'-- Source: src/lib/game/official-data.ts, via scripts/generate-seed.ts',
	'--',
	'-- Official JLPT N4 & N3 Question Set.',
	'--',
	'-- Re-runnable: content rows are replaced, play data is left alone.',
	'',
	'DELETE FROM choices;',
	'DELETE FROM questions;',
	'DELETE FROM topics;',
	'',
]

for (const topic of Object.values(TOPICS)) {
	lines.push(
		'INSERT INTO topics (id, slug, name_en, name_ja, min_level, sort_order, is_active) VALUES ' +
			`(${topic.id}, ${lit(topic.slug)}, ${lit(topic.nameEn)}, ${lit(topic.nameJa)}, ` +
			`${lit(topic.minLevel)}, ${topic.sortOrder}, 1);`,
	)
}
lines.push('')

for (const question of OFFICIAL_QUESTIONS) {
	lines.push(
		'INSERT INTO questions (id, level, topic_id, format, prompt, prompt_furigana, prompt_en, ' +
			'audio_url, explanation, difficulty, is_active) VALUES ' +
			`(${question.id}, ${lit(question.level)}, ${question.topic.id}, ${lit(question.format)}, ` +
			`${lit(question.prompt)}, ${lit(question.promptFurigana)}, ${lit(question.promptEn)}, ` +
			`${lit(question.audioUrl)}, ${lit(question.explanation)}, ${question.difficulty}, 1);`,
	)
	for (const choice of question.choices) {
		lines.push(
			'INSERT INTO choices (id, question_id, body, is_correct, position) VALUES ' +
				`(${choice.id}, ${question.id}, ${lit(choice.body)}, ${choice.isCorrect ? 1 : 0}, ` +
				`${choice.position});`,
		)
	}
}

lines.push('')

const output = lines.join('\n')
const seedPath = resolve(import.meta.dirname, '../drizzle/seed.sql')
writeFileSync(seedPath, output, 'utf-8')
process.stdout.write(output)
