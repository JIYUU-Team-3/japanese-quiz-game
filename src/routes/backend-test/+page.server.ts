import { and, desc, eq, isNotNull } from 'drizzle-orm'
import type { Actions, PageServerLoad } from './$types'
import {
	jlptLevels,
	players,
	questionFormats,
	sessionModes,
	sessions,
} from '#lib/server/db/schema.js'

export const load: PageServerLoad = async ({ locals }) => {
	const [topics, sessions_list] = await Promise.all([
		locals.repos.topics.list(),
		locals.db.select().from(sessions).orderBy(desc(sessions.startedAt)).limit(20),
	])

	return { topics, sessions_list, jlpt_levels: jlptLevels, question_formats: questionFormats, session_modes: sessionModes }
}

export const actions: Actions = {
	create_topic: async ({ request, locals }) => {
		const form = await request.formData()
		const row = await locals.repos.topics.create({
			slug: String(form.get('slug')),
			nameEn: String(form.get('name_en')),
			nameJa: String(form.get('name_ja')),
			minLevel: String(form.get('min_level')) as (typeof jlptLevels)[number],
			sortOrder: Number(form.get('sort_order')),
			isActive: form.get('is_active') === 'on',
		})
		return { action: 'create_topic', result: row }
	},

	create_question: async ({ request, locals }) => {
		const form = await request.formData()
		const row = await locals.repos.questions.create({
			level: String(form.get('level')) as (typeof jlptLevels)[number],
			topicId: Number(form.get('topic_id')),
			format: String(form.get('format')) as (typeof questionFormats)[number],
			prompt: String(form.get('prompt')),
			promptFurigana: form.get('prompt_furigana') ? String(form.get('prompt_furigana')) : null,
			promptEn: form.get('prompt_en') ? String(form.get('prompt_en')) : null,
			explanation: form.get('explanation') ? String(form.get('explanation')) : null,
			difficulty: Number(form.get('difficulty')),
			isActive: form.get('is_active') === 'on',
			createdAt: new Date(),
		})
		return { action: 'create_question', result: row }
	},

	create_choice: async ({ request, locals }) => {
		const form = await request.formData()
		const row = await locals.repos.choices.create({
			questionId: Number(form.get('question_id')),
			body: String(form.get('body')),
			isCorrect: form.get('is_correct') === 'on',
			position: Number(form.get('position')),
		})
		return { action: 'create_choice', result: row }
	},

	list_questions_by_topic: async ({ request, locals }) => {
		const form = await request.formData()
		const topic_id = Number(form.get('topic_id'))
		const rows = await locals.repos.questions.list_by_topic(topic_id)
		return { action: 'list_questions_by_topic', result: rows }
	},

	list_choices_by_question: async ({ request, locals }) => {
		const form = await request.formData()
		const question_id = Number(form.get('question_id'))
		const rows = await locals.repos.choices.list_by_question(question_id)
		return { action: 'list_choices_by_question', result: rows }
	},

	create_session: async ({ request, locals }) => {
		const form = await request.formData()
		const topic_id_raw = form.get('topic_id')
		const [row] = await locals.repos.sessions.create({
			level: String(form.get('level')) as (typeof jlptLevels)[number],
			mode: String(form.get('mode')) as (typeof sessionModes)[number],
			topicId: topic_id_raw ? Number(topic_id_raw) : null,
			status: 'in_progress',
			questionCount: Number(form.get('question_count')),
			correctCount: 0,
			wrongCount: 0,
			maxStreak: 0,
			score: 0,
			startedAt: new Date(),
		})
		return { action: 'create_session', result: row }
	},

	submit_answer: async ({ request, locals }) => {
		const form = await request.formData()
		const session_id = String(form.get('session_id'))
		const position = Number(form.get('position'))
		const is_correct = form.get('is_correct') === 'on'
		const points = Number(form.get('points') || 0)

		const answer = await locals.repos.session_answers.create({
			sessionId: session_id,
			position,
			questionId: Number(form.get('question_id')),
			choiceId: form.get('choice_id') ? Number(form.get('choice_id')) : null,
			isCorrect: is_correct,
			answerMs: form.get('answer_ms') ? Number(form.get('answer_ms')) : null,
			points,
			answeredAt: new Date(),
		})

		const session = await locals.repos.sessions.find_by_id(session_id)
		if (!session) return { action: 'submit_answer', result: answer, error: 'session not found' }

		const answers = await locals.repos.session_answers.list_by_session(session_id)
		let current_streak = 0
		for (const a of [...answers].sort((a, b) => b.position - a.position)) {
			if (!a.isCorrect) break
			current_streak += 1
		}

		const [updated_session] = await locals.repos.sessions.update(session_id, {
			correctCount: session.correctCount + (is_correct ? 1 : 0),
			wrongCount: session.wrongCount + (is_correct ? 0 : 1),
			maxStreak: Math.max(session.maxStreak, current_streak),
			score: session.score + points,
		})

		return { action: 'submit_answer', result: { answer, updated_session } }
	},

	complete_session: async ({ request, locals }) => {
		const form = await request.formData()
		const session_id = String(form.get('session_id'))
		const session = await locals.repos.sessions.find_by_id(session_id)
		if (!session) return { action: 'complete_session', error: 'session not found' }

		const finished_at = new Date()
		const [updated] = await locals.repos.sessions.update(session_id, {
			status: 'finished',
			finishedAt: finished_at,
			durationMs: finished_at.getTime() - session.startedAt.getTime(),
		})
		return { action: 'complete_session', result: updated }
	},

	create_player: async ({ request, locals }) => {
		const form = await request.formData()
		try {
			const [row] = await locals.repos.players.create({
				name: String(form.get('name')),
				createdAt: new Date(),
			})
			return { action: 'create_player', result: row }
		} catch (e) {
			return { action: 'create_player', error: e instanceof Error ? e.message : String(e) }
		}
	},

	link_session_player: async ({ request, locals }) => {
		const form = await request.formData()
		const session_id = String(form.get('session_id'))
		const player_id = Number(form.get('player_id'))
		const [row] = await locals.repos.sessions.update(session_id, { playerId: player_id })
		return { action: 'link_session_player', result: row }
	},

	list_ranking: async ({ request, locals }) => {
		const form = await request.formData()
		const level = form.get('level') ? String(form.get('level')) : null

		const rows = await locals.db
			.select({ session: sessions, player: players })
			.from(sessions)
			.innerJoin(players, eq(sessions.playerId, players.id))
			.where(
				level
					? and(
							isNotNull(sessions.playerId),
							eq(sessions.level, level as (typeof jlptLevels)[number]),
						)
					: isNotNull(sessions.playerId),
			)
			.orderBy(desc(sessions.score))
			.limit(10)

		return { action: 'list_ranking', result: rows }
	},
}
