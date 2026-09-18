/**
 * The cabinet's voice.
 *
 * Every cue is a recorded sample under `static/sfx`, played through one Web
 * Audio graph so the game has a single master to mute and a single place to
 * balance levels.
 *
 * This file carries a rune (`muted`) because the mute switch is state a screen
 * binds to — hence the `.svelte.ts` extension. Nothing else here is reactive:
 * the cues are fired imperatively, the way a button press fires one.
 */

/** Cue names, as the screens say them. */
export type Cue = 'press' | 'start' | 'correct' | 'miss' | 'over'

/**
 * Per-cue playback gain.
 *
 * These are not taste. Each clip was measured (RMS over its audible span) and
 * the gain is the factor that lands it on a common loudness, so no one cue
 * jumps out of the mix:
 *
 *   button    −21.9 dBFS → ×0.88      correct   −13.0 dBFS → ×0.31
 *   incorrect −15.7 dBFS → ×0.43      positive  −17.3 dBFS → ×0.52
 *   start     −28.5 dBFS → ×1.86
 *
 * `start` is boosted above unity because it was mastered quiet; its peak is
 * under half of full scale, so there is headroom for it and nothing clips.
 * Replace a file and the number beside it is wrong — remeasure, do not guess.
 */
const CUES: Readonly<Record<Cue, { src: string; gain: number }>> = {
	press: { src: '/sfx/button.mp3', gain: 0.88 },
	start: { src: '/sfx/start.mp3', gain: 1.86 },
	correct: { src: '/sfx/correct.mp3', gain: 0.31 },
	miss: { src: '/sfx/incorrect.mp3', gain: 0.43 },
	over: { src: '/sfx/positive.mp3', gain: 0.52 },
}

/**
 * How long the miss cue is actually audible.
 *
 * `incorrect.mp3` is 1752ms of file but one decaying hit: it is down in the
 * noise by 740ms and silent after. The ✕ on screen is timed off this number,
 * not off the file length, or the stamp would sit there over a dead speaker.
 *
 * ⚠ This is `MISS_MS` in `src/routes/play/+page.svelte` and the `miss-stamp`
 * keyframes in its stylesheet. Picture and sound are one event on two clocks.
 */
export const MISS_CUE_MS = 740

/** Master level for the cues. The one knob a mix change should reach for. */
const MASTER = 0.9

/**
 * Where the music stands.
 *
 * The cabinet is never silent: the loop runs on every screen at its own level,
 * and drops to a bed only while a question is live — the player is reading a
 * prompt against a ten-second clock, and music that can be attended to is
 * music in the way. Both sit far under the cues, which must always cut through.
 */
export type MusicLevel = 'full' | 'bed'

const MUSIC_LEVELS: Readonly<Record<MusicLevel, number>> = {
	full: 0.22,
	bed: 0.08,
}

const MUTE_KEY = 'nihongo-attack:muted'

let ctx: AudioContext | null = null
let bus: GainNode | null = null
let failed = false
/**
 * Decoded cues, by name. A cue fired before its buffer lands is simply silent.
 *
 * A plain record and not a `Map`: nothing reads this reactively, and a bare
 * `Map` in a `.svelte.ts` file is the kind of thing that ought to be a
 * `SvelteMap` often enough that the linter is right to ask.
 */
const buffers: Partial<Record<Cue, AudioBuffer>> = {}
let loading: Promise<void> | null = null

let music: HTMLAudioElement | null = null
let musicLevel: MusicLevel | null = null

function storedMute(): boolean {
	if (typeof localStorage === 'undefined') return false
	try {
		return localStorage.getItem(MUTE_KEY) === '1'
	} catch {
		// Private mode, or storage disabled. The preference is a convenience,
		// never a requirement.
		return false
	}
}

let mutedState = $state(storedMute())

/**
 * The mute switch, as a screen sees it.
 *
 * An object with an accessor rather than a bare `export let`, because a module
 * export cannot carry reactivity across an import boundary — the getter can.
 */
export const sound = {
	get muted(): boolean {
		return mutedState
	},
	set muted(next: boolean) {
		mutedState = next
		try {
			localStorage.setItem(MUTE_KEY, next ? '1' : '0')
		} catch {
			// Nothing to do, and nothing worth telling the player about.
		}
		if (bus && ctx) bus.gain.setTargetAtTime(next ? 0 : MASTER, ctx.currentTime, 0.01)
		applyMusic()
	},
}

/** Flips the switch. What the on-screen control calls. */
export function toggleMute(): void {
	sound.muted = !sound.muted
}

function context(): AudioContext | null {
	if (failed) return null
	if (ctx) return ctx
	const Ctor =
		typeof AudioContext === 'function'
			? AudioContext
			: ((globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? null)
	if (!Ctor) {
		failed = true
		return null
	}
	try {
		ctx = new Ctor()
		bus = ctx.createGain()
		bus.gain.value = mutedState ? 0 : MASTER
		bus.connect(ctx.destination)
		return ctx
	} catch {
		// A browser that refuses to hand out a context at all is a browser this
		// game is still perfectly playable in. Never ask twice.
		failed = true
		return null
	}
}

function load(audio: AudioContext): Promise<void> {
	loading ??= Promise.all(
		(Object.keys(CUES) as Cue[]).map(async (name) => {
			try {
				const response = await fetch(CUES[name].src)
				if (!response.ok) return
				buffers[name] = await audio.decodeAudioData(await response.arrayBuffer())
			} catch {
				// One cue that will not decode costs that cue, not the run.
			}
		}),
	).then(() => undefined)
	return loading
}

/**
 * Opens the audio hardware on a user gesture and fetches the cues.
 *
 * Browsers will not let a page make noise until the player has touched it, and
 * a miss can happen with no gesture anywhere near it — the ten-second clock
 * running out is the machine acting, not the player. So the context is opened
 * on the first press the player makes, and it is still open when the clock
 * expires four questions later.
 *
 * Safe to call on every gesture; after the first it costs a property read.
 */
export function unlockAudio(): void {
	const audio = context()
	if (!audio) return
	if (audio.state === 'suspended') void audio.resume()
	void load(audio)
	// A cold load leaves the title screen's music level set with nothing playing,
	// because the browser refused it; this is where that debt is paid.
	applyMusic()
}

/**
 * Fires a cue.
 *
 * Returns silently if audio is unavailable, still muted, or not yet decoded.
 * Nothing on screen is load-bearing on sound: the ✕ carries a miss on its own.
 */
export function play(cue: Cue): void {
	const audio = ctx
	if (!audio || !bus || mutedState || audio.state !== 'running') return
	const buffer = buffers[cue]
	if (!buffer) return

	const source = audio.createBufferSource()
	source.buffer = buffer
	const level = audio.createGain()
	level.gain.value = CUES[cue].gain
	source.connect(level)
	level.connect(bus)
	source.start()
	// Drop the pair once it has rung out, so a long run does not leave a node
	// per answer hanging off the bus.
	source.onended = () => {
		source.disconnect()
		level.disconnect()
	}
}

function applyMusic(): void {
	if (!music) return
	if (musicLevel === null || mutedState) {
		// Paused where it stands, never rewound, so turning sound back on picks the tape up
		// where it was rather than starting it over.
		music.volume = 0
		music.pause()
		return
	}
	music.volume = MUSIC_LEVELS[musicLevel]
	// A rejected play() means the first gesture has not happened yet — the
	// normal state of whatever screen a visitor lands on cold. `musicLevel`
	// stays set, and `unlockAudio` comes back through here on the first press.
	void music.play().catch(() => undefined)
}

/**
 * Says where the music should stand. Idempotent, so it can be asserted as often
 * as the caller likes.
 *
 * The music is an `<audio>` element rather than a buffer in the graph above:
 * it is 50 seconds long, and decoding it to PCM would cost ~19MB of memory to
 * play back something that needs no scheduling and never overlaps itself. It
 * also means moving between screens is a volume change on one running element
 * rather than a stop and a start, so the loop never restarts mid-navigation.
 */
export function setMusic(level: MusicLevel): void {
	if (typeof Audio !== 'function') return
	if (level === musicLevel && music) return
	musicLevel = level
	if (!music) {
		music = new Audio('/sfx/bgm.mp3')
		music.loop = true
		music.preload = 'auto'
	}
	applyMusic()
}
