/**
 * The cabinet's voice.
 *
 * Nothing here is a sample. A 1980s board had no room for recorded audio — it
 * had a programmable sound generator and three square-wave channels — so every
 * cue is synthesised from oscillators at call time. That is the period-correct
 * answer and it also means the game ships no audio asset, needs no licence, and
 * costs no bytes.
 *
 * This module must stay free of Svelte runes: it is plain browser code that a
 * component calls, and it owns no state a screen can bind to.
 */

/**
 * One stamp of the miss cue: when it sounds and how long it is held.
 *
 * The shape is the Japanese quiz-show wrong-answer buzzer, ブッブー: a clipped
 * ブッ and then a held ブー, on one pitch. Every stock library files it under
 * 不正解 in that form, and it is the sound a player already hears in their
 * head when they see ✕.
 *
 * ⚠ These offsets ARE the `@keyframes miss-stamp` stops in `src/routes/play`.
 * Each note lights the ✕ and each silence darkens it — picture and sound are
 * one event on two clocks, and they only read as one because the numbers
 * agree. `MISS_MS` in the component is where the last note ends.
 */
interface Note {
	/** Milliseconds from the start of the cue. */
	at: number
	/** How long the note is held, in milliseconds. */
	hold: number
}

const NOTES: readonly Note[] = [
	// ブッ — cut short, so the second note lands as the verdict.
	{ at: 0, hold: 140 },
	// ブー — the held one. The ✕ stays up exactly as long as this does.
	{ at: 220, hold: 500 },
]

/**
 * The buzzer is all three channels of the chip at once. Two squares a few hertz
 * apart beat against each other, which is the rasp that makes a buzz a buzz and
 * not a tone; the third sits an octave under them for weight.
 */
const CHANNELS: readonly { hz: number; level: number }[] = [
	{ hz: 185, level: 0.5 },
	{ hz: 191, level: 0.5 },
	{ hz: 92.5, level: 0.35 },
]

/** Master level. Low on purpose: a wrong answer should sting, not startle. */
const MASTER = 0.06

/**
 * Long enough to stop a square wave clicking at its edges, short enough that
 * the note still reads as switched rather than faded. The picture cuts hard;
 * the sound may not, because an instantaneous amplitude step is a click.
 */
const EDGE_S = 0.004

let ctx: AudioContext | null = null
let failed = false

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
		return ctx
	} catch {
		// A browser that refuses to hand out a context at all is a browser this
		// game is still perfectly playable in. Never ask twice.
		failed = true
		return null
	}
}

/**
 * Opens the audio hardware on a user gesture.
 *
 * Browsers will not let a page make noise until the player has touched it, and
 * a miss can happen with no gesture anywhere near it — the ten-second clock
 * running out is the machine acting, not the player. So the context is opened
 * when the run is started, which is always a real tap, and it is still open
 * when the clock expires four questions later.
 *
 * Safe to call on every gesture; after the first it costs a property read.
 */
export function unlockAudio(): void {
	const audio = context()
	if (audio && audio.state === 'suspended') void audio.resume()
}

/**
 * Plays ブッブー, in step with the ✕ on screen.
 *
 * Every note is scheduled up front against the audio clock rather than fired
 * from timers. `setTimeout` is subject to the main thread and would drift
 * against a compositor-driven CSS animation by tens of milliseconds, which is
 * audible as the buzz sliding off the stamp. Scheduled this way, both clocks
 * start once and neither waits on JavaScript again.
 *
 * Returns silently if audio is unavailable or was never unlocked. The ✕ carries
 * the miss on its own; the sound is not load-bearing.
 */
export function playMiss(): void {
	const audio = context()
	if (!audio || audio.state !== 'running') return

	// One master gain for the whole cue, so a mute or a volume control later has
	// exactly one place to reach in.
	const bus = audio.createGain()
	bus.gain.value = MASTER
	bus.connect(audio.destination)

	const start = audio.currentTime

	for (const note of NOTES) {
		const at = start + note.at / 1000
		const until = at + note.hold / 1000

		// One envelope per note, shared by the channels, so the three stop as one
		// buzzer and never as three tones trailing off at different moments.
		const env = audio.createGain()
		env.gain.setValueAtTime(0, at)
		env.gain.linearRampToValueAtTime(1, at + EDGE_S)
		env.gain.setValueAtTime(1, until - EDGE_S)
		env.gain.linearRampToValueAtTime(0, until)
		env.connect(bus)

		for (const channel of CHANNELS) {
			const osc = audio.createOscillator()
			// Square, not sine or saw: a PSG had neither to give.
			osc.type = 'square'
			osc.frequency.setValueAtTime(channel.hz, at)
			const mix = audio.createGain()
			mix.gain.value = channel.level
			osc.connect(mix)
			mix.connect(env)
			osc.start(at)
			osc.stop(until)
		}
	}

	// Drop the bus once the last note has rung out, so a long run does not leave
	// a node per miss hanging off the destination.
	const last = NOTES[NOTES.length - 1]
	window.setTimeout(() => bus.disconnect(), last.at + last.hold + 200)
}

/** Closes the audio hardware. Called when the play screen goes away. */
export function releaseAudio(): void {
	if (!ctx) return
	void ctx.close()
	ctx = null
}
