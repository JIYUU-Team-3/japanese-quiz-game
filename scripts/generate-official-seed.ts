/**
 * Emits `drizzle/official_seed.sql` from the official JLPT question set.
 *
 *   node --experimental-strip-types scripts/generate-official-seed.ts > drizzle/official_seed.sql
 */

import { OFFICIAL_QUESTIONS, TOPICS } from '../src/lib/game/official-data.ts'

/** SQLite string literal: single quotes doubled, nothing else escaped. */
function lit(value: string | null): string {
	return value === null ? 'NULL' : `'${value.replace(/'/g, "''")}'`
}

const lines: string[] = [
	'-- GENERATED FILE — do not edit by hand.',
	'-- Source: src/lib/game/official-data.ts, via scripts/generate-official-seed.ts',
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

process.stdout.write(lines.join('\n') + '\n')
