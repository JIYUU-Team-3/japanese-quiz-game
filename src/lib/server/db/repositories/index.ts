import type { get_db } from '../index'
import { ChoicesRepository } from './choices.repository'
import { PlayersRepository } from './players.repository'
import { QuestionsRepository } from './questions.repository'
import { SessionAnswersRepository } from './session-answers.repository'
import { SessionsRepository } from './sessions.repository'
import { TopicsRepository } from './topics.repository'

export const get_repositories = (db: ReturnType<typeof get_db>) => ({
	choices: new ChoicesRepository(db),
	players: new PlayersRepository(db),
	questions: new QuestionsRepository(db),
	session_answers: new SessionAnswersRepository(db),
	sessions: new SessionsRepository(db),
	topics: new TopicsRepository(db),
})
