import type { Question, Topic } from './types'

/**
 * PLACEHOLDER CONTENT — NOT A VETTED JLPT SET.
 *
 * PRODUCT.md records the question source as an open decision. These items were
 * authored for development so the game is playable and tunable end to end; the
 * Japanese is correct, but nothing here has been reviewed against an official
 * JLPT syllabus and it must not be presented to learners as authoritative study
 * material.
 *
 * THIS FILE IS THE SEED, NOT A FALLBACK. Nothing at runtime imports it — the
 * game reads every question from D1. It is authored here rather than as loose
 * SQL so the bank is checked by the same compiler as the rest of the game and
 * cannot drift out of the `Question` shape. `scripts/generate-seed.ts` compiles
 * it to `drizzle/seed.sql`; after editing, run `pnpm db:seed:gen` and then
 * `pnpm db:seed:local` (or `db:seed:remote`), or the change reaches no player.
 */

export const TOPICS: Record<'vocab' | 'grammar', Topic> = {
	vocab: {
		id: 1,
		slug: 'vocab',
		nameEn: 'Vocabulary',
		nameJa: '\u8a9e\u5f59',
		minLevel: 'N5',
		sortOrder: 1,
	},
	grammar: {
		id: 2,
		slug: 'grammar',
		nameEn: 'Grammar',
		nameJa: '\u6587\u6cd5',
		minLevel: 'N5',
		sortOrder: 2,
	},
}

let choiceId = 0

/** Builds one question; the FIRST body given is the correct one. */
function q(
	id: number,
	level: Question['level'],
	topic: Topic,
	prompt: string,
	bodies: readonly string[],
	explanation: string,
): Question {
	return {
		id,
		level,
		topic,
		format: 'multiple_choice',
		prompt,
		promptFurigana: null,
		promptEn: null,
		audioUrl: null,
		explanation,
		difficulty: 1,
		choices: bodies.map((body, i) => ({
			id: ++choiceId,
			body,
			isCorrect: i === 0,
			position: i,
		})),
	}
}

export const MOCK_QUESTIONS: readonly Question[] = [
	q(
		1,
		'N4',
		TOPICS.grammar,
		'日本へ＿＿＿ことがあります。',
		['行った', '行く', '行って', '行き'],
		'〜たことがある — to have done something before. "I have been to Japan."',
	),
	q(
		2,
		'N4',
		TOPICS.grammar,
		'部屋を出る前に、電気を消さ＿＿＿。',
		['なければなりません', 'てもいいです', 'たいです', 'ましょうか'],
		'〜なければならない — must do. "You have to turn the light off before leaving."',
	),
	q(
		3,
		'N4',
		TOPICS.grammar,
		'音楽を聞き＿＿＿勉強します。',
		['ながら', 'ないで', 'たり', 'ので'],
		'〜ながら — while doing. "I study while listening to music."',
	),
	q(
		4,
		'N4',
		TOPICS.grammar,
		'明日雨が降っ＿＿＿、試合は中止です。',
		['たら', 'ても', 'ながら', 'のに'],
		'〜たら — if / when. "If it rains tomorrow, the match is cancelled."',
	),
	q(
		5,
		'N4',
		TOPICS.grammar,
		'この漢字の読み方を教えて＿＿＿ませんか。',
		['くれ', 'あげ', 'いき', 'おき'],
		'〜てくれませんか — asking a favour. "Could you teach me how to read this kanji?"',
	),
	q(
		6,
		'N4',
		TOPICS.grammar,
		'弟はまだ子ども＿＿＿、よく手伝ってくれます。',
		['なのに', 'だから', 'なので', 'だと'],
		'〜のに — although. "Even though my brother is still a child, he helps a lot."',
	),
	q(
		7,
		'N4',
		TOPICS.vocab,
		'「やくそく」を漢字で書くと？',
		['約束', '予約', '契約', '結束'],
		'約束（やくそく）— a promise, an appointment.',
	),
	q(
		8,
		'N4',
		TOPICS.vocab,
		'分からないことを先生に＿＿＿しました。',
		['相談', '招待', '紹介', '選択'],
		'相談する — to consult, to talk something over. "I consulted my teacher."',
	),
	q(
		9,
		'N4',
		TOPICS.vocab,
		'旅行の＿＿＿をしています。',
		['準備', '進歩', '生産', '事務'],
		'準備（じゅんび）— preparation. "I am getting ready for the trip."',
	),
	q(
		10,
		'N4',
		TOPICS.vocab,
		'この機械の使い方を＿＿＿してください。',
		['説明', '説得', '報告', '注文'],
		'説明する — to explain. "Please explain how to use this machine."',
	),
	q(
		11,
		'N4',
		TOPICS.vocab,
		'「くらべる」の意味に近いのはどれ？',
		['比較する', '想像する', '解決する', '応援する'],
		'比べる＝比較する — to compare.',
	),
	q(
		12,
		'N4',
		TOPICS.vocab,
		'駅までの道が＿＿＿分かりません。',
		['ぜんぜん', 'とても', 'ずいぶん', 'なるべく'],
		'全然〜ない — not at all. "I have no idea how to get to the station."',
	),
	q(
		13,
		'N3',
		TOPICS.grammar,
		'彼が犯人に＿＿＿ありません。',
		['違い', 'すぎ', 'かぎり', 'ばかり'],
		'〜に違いない — must be, no doubt. "He must be the culprit."',
	),
	q(
		14,
		'N3',
		TOPICS.grammar,
		'寝坊した＿＿＿、電車に乗り遅れた。',
		['せいで', 'おかげで', 'ために', 'ように'],
		'〜せいで — because of (blame). "I missed the train because I overslept."',
	),
	q(
		15,
		'N3',
		TOPICS.grammar,
		'知っている＿＿＿、教えてくれなかった。',
		['くせに', 'ながら', 'ばかりに', 'うえに'],
		'〜くせに — despite, and yet (with reproach). "He knew, and still didn\'t tell me."',
	),
	q(
		16,
		'N3',
		TOPICS.grammar,
		'彼女に会う＿＿＿、元気をもらう。',
		['たびに', 'うちに', 'ところに', 'とたんに'],
		'〜たびに — every time. "Every time I see her, she cheers me up."',
	),
	q(
		17,
		'N3',
		TOPICS.grammar,
		'嫌いな＿＿＿が、あまり食べません。',
		['わけではない', 'ことはない', 'はずがない', 'ものではない'],
		'〜わけではない — it is not that. "It\'s not that I dislike it, I just don\'t eat much."',
	),
	q(
		18,
		'N3',
		TOPICS.grammar,
		'会議は来週の月曜日＿＿＿行われます。',
		['において', 'にとって', 'によって', 'について'],
		'〜において — at / in (formal setting). "The meeting will be held on Monday."',
	),
	q(
		19,
		'N3',
		TOPICS.vocab,
		'痛くても＿＿＿してください。',
		['我慢', '遠慮', '油断', '無理'],
		'我慢（がまん）する — to endure, to put up with.',
	),
	q(
		20,
		'N3',
		TOPICS.vocab,
		'手続きが＿＿＿で、時間がかかった。',
		['面倒', '慎重', '快適', '順調'],
		'面倒（めんどう）— troublesome, a hassle.',
	),
	q(
		21,
		'N3',
		TOPICS.vocab,
		'「あいまい」の意味は？',
		['はっきりしない', 'とても正しい', 'すぐ終わる', 'よく知られた'],
		'曖昧（あいまい）— vague, ambiguous.',
	),
	q(
		22,
		'N3',
		TOPICS.vocab,
		'仕事を先輩に＿＿＿しました。',
		['依頼', '依存', '意識', '維持'],
		'依頼（いらい）する — to request, to commission.',
	),
	q(
		23,
		'N3',
		TOPICS.vocab,
		'雨で試合が＿＿＿になった。',
		['中止', '中断', '中央', '集中'],
		'中止（ちゅうし）— cancellation. "The match was called off."',
	),
	q(
		24,
		'N3',
		TOPICS.vocab,
		'彼の説明はとても＿＿＿だった。',
		['具体的', '消極的', '一時的', '相対的'],
		'具体的（ぐたいてき）— concrete, specific.',
	),
]
