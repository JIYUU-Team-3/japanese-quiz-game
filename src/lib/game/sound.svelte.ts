/**
 * The cabinet's voice.
 *
 * Every cue is a recorded sample under `static/sfx`, played through one Web
 * Audio graph so the game has a single master to mute and a single place to
 * balance levels. The music is separate — media elements rather than the graph,
 * with its own switch — for the reasons given at `sound` and `setMusic`.
 *
 * This file carries runes (`musicMuted`, `sfxMuted`) because the two switches
 * are state a screen binds to — hence the `.svelte.ts` extension. Nothing else
 * here is reactive: the cues are fired imperatively, the way a button press
 * fires one.
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
 * The cabinet's four pieces of music, and what each one is for.
 *
 * `gain` is not taste, on the same principle as the cue gains above. The four
 * tracks are four different masters and arrive at four different loudnesses, so
 * an equal `gain` would *not* be an equal volume — the quiz track alone is 5 LU
 * hotter than the title theme. Each was measured (EBU R128 integrated loudness
 * over the whole file) and its gain is the factor that lands it on one shared
 * level, so no track jumps when the cabinet hands over to the next:
 *
 *   title    −17.2 LUFS → ×0.22      play     −11.9 LUFS → ×0.12
 *   credits  −13.5 LUFS → ×0.14      gameover −12.0 LUFS → ×0.12
 *
 * That level is ≈−30.4 LUFS out, which is where the title theme at 0.22 already
 * sat — it was the one the cabinet was balanced at, so it is the one the other
 * three were brought to. The spread across all four is now under 0.3 LU, well
 * inside what anyone can hear. They still sit far under the cues, which must
 * always cut through.
 *
 * Replace a file and the number beside it is wrong. Remeasure it with
 * `ffmpeg -i <file> -af ebur128 -f null -` and solve for the gain that holds
 * the shared level — `10 ^ ((−30.4 − measured) / 20)` — do not guess.
 *
 * `fromTop` says whether cueing the track restarts it. A run, a credits roll
 * and a game over each *begin*, so they get their opening bar; the title theme
 * is the room you keep coming back to, so it carries on where it stood.
 */
export type MusicTrack = 'title' | 'play' | 'credits' | 'gameover'

/** What a screen asks for: one of the tracks, or silence. */
export type MusicCue = MusicTrack | 'off'

const TRACKS: Readonly<Record<MusicTrack, { src: string; gain: number; fromTop: boolean }>> = {
	title: { src: '/sfx/bgm.mp3', gain: 0.22, fromTop: false },
	play: { src: '/sfx/play-bgm.mp3', gain: 0.12, fromTop: true },
	credits: { src: '/sfx/credit.mp3', gain: 0.14, fromTop: true },
	gameover: { src: '/sfx/gameover.mp3', gain: 0.12, fromTop: true },
}

const TRACK_NAMES = Object.keys(TRACKS) as MusicTrack[]

/**
 * How long one track takes to hand over to the next.
 *
 * The two ramps run together rather than end to end: the outgoing track is
 * still audible as the incoming one arrives, which is what makes a change of
 * screen feel like a change of scene instead of a tape being swapped.
 */
const CROSSFADE_MS = 900

/**
 * How long a track left over from an interrupted handover gets to disappear.
 *
 * Short, because the player has already moved past the change it belonged to
 * and it is only in the way — but not instant, since cutting an audible element
 * dead is a click. See the loop in `setMusic`.
 */
const STRAGGLER_FADE_MS = 150

/**
 * How long `positive.mp3` — the GAME OVER cue — is actually audible.
 *
 * Measured, not taken from the file length: the file is 1698ms but the hit has
 * decayed into the noise by 1120ms and the rest is silence. The game-over theme
 * is held off until this has passed, so the cue gets the room to itself and the
 * music arrives after it rather than under it.
 *
 * ⚠ Tied to the `over` cue's file. Replace `positive.mp3` and remeasure.
 */
const OVER_CUE_MS = 1120

const MUSIC_MUTE_KEY = 'nihongo-attack:muted:music'
const SFX_MUTE_KEY = 'nihongo-attack:muted:sfx'
/**
 * The single switch these two replaced.
 *
 * Still read, as the fallback for either, so a player who silenced the cabinet
 * when it had one switch finds it silent when it has two. Left in place rather
 * than migrated and deleted: it costs one read on a cold load, and a player who
 * goes back to an older build keeps their preference.
 */
const LEGACY_MUTE_KEY = 'nihongo-attack:muted'

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

/**
 * One `<audio>` element per track, built the first time that track is cued.
 *
 * Lazy because the four of them are ~14MB between them: a player who only ever
 * sees the title screen should pay for the title theme and nothing else.
 */
const players: Partial<Record<MusicTrack, HTMLAudioElement>> = {}
/** The in-flight volume ramp per track, if one is running. See `rampTo`. */
const fades: Partial<Record<MusicTrack, number>> = {}
/** The track the cabinet wants playing, or null for silence. */
let current: MusicTrack | null = null
/** A cue waiting out the GAME OVER hit before it comes in. See `setMusic`. */
let held: number | null = null
/**
 * Whether the boot screen is still up. Until `powerOn`, music is loaded but
 * never heard.
 *
 * Starts true and has exactly one way to become false, because the boot screen
 * is in every page load: it is up before any screen asks for a track, and the
 * track it asks for must arrive with the reveal rather than under the gate.
 */
let booting = true

function storedMute(key: string): boolean {
	if (typeof localStorage === 'undefined') return false
	try {
		return (localStorage.getItem(key) ?? localStorage.getItem(LEGACY_MUTE_KEY)) === '1'
	} catch {
		// Private mode, or storage disabled. The preference is a convenience,
		// never a requirement.
		return false
	}
}

function remember(key: string, muted: boolean): void {
	try {
		localStorage.setItem(key, muted ? '1' : '0')
	} catch {
		// Nothing to do, and nothing worth telling the player about.
	}
}

let musicMuted = $state(storedMute(MUSIC_MUTE_KEY))
let sfxMuted = $state(storedMute(SFX_MUTE_KEY))

/**
 * The two mute switches, as a screen sees them.
 *
 * Separate because they are two different complaints. Music is the thing a
 * player turns off to put their own on; the cues are what tells them they were
 * right or wrong, and silencing those takes information away rather than just
 * atmosphere. One switch could only ever answer both at once.
 *
 * They reach the sound through different paths, and that is not incidental:
 * the cues run through one gain node, so `sfx` is that node, while the music is
 * a set of media elements, so `music` goes out through `applyMusic`.
 *
 * Read as ON rather than muted, because that is what the switch on the cabinet
 * says. An object with accessors rather than bare exports, because a module
 * export cannot carry reactivity across an import boundary — the getters can.
 */
export const sound = {
	get musicOn(): boolean {
		return !musicMuted
	},
	set musicOn(on: boolean) {
		musicMuted = !on
		remember(MUSIC_MUTE_KEY, musicMuted)
		// Hard: a crossfade in flight loses to the switch, rather than fading up
		// into a cabinet the player has just silenced.
		applyMusic(true)
	},
	get sfxOn(): boolean {
		return !sfxMuted
	},
	set sfxOn(on: boolean) {
		sfxMuted = !on
		remember(SFX_MUTE_KEY, sfxMuted)
		if (bus && ctx) bus.gain.setTargetAtTime(sfxMuted ? 0 : MASTER, ctx.currentTime, 0.01)
	},
}

/** Flips one switch or the other. What the on-screen controls call. */
export function toggleMusic(): void {
	sound.musicOn = !sound.musicOn
}

export function toggleSfx(): void {
	sound.sfxOn = !sound.sfxOn
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
		bus.gain.value = sfxMuted ? 0 : MASTER
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
	if (!audio || !bus || sfxMuted || audio.state !== 'running') return
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

/** Drops the ramp on one track, so the last writer of its volume wins outright. */
function stopFade(track: MusicTrack): void {
	const timer = fades[track]
	if (timer === undefined) return
	clearInterval(timer)
	delete fades[track]
}

/** How often a ramp touches the volume. */
const FADE_TICK_MS = 16

/**
 * Slides one track's volume to `target` over `ms`, then calls `done`.
 *
 * Element volumes rather than gain nodes: the music never entered the graph the
 * cues run through (see `setMusic`). Ramps are per track and run independently,
 * which is what lets two of them overlap into a crossfade.
 *
 * ⚠ A timer and not `requestAnimationFrame`, though this is an animation and
 * `rAF` is the obvious reach. A volume fade is not a picture: it has to finish
 * on a page that is not painting — backgrounded, occluded, a window behind
 * another — and `rAF` does not run there. Driven by frames, a fade that starts
 * as the page stops drawing stalls *partway*, which for a crossfade means both
 * tracks stranded half-up until the page draws again. The clock is read from
 * `performance.now()` rather than counted in ticks, so a throttled timer
 * (background tabs get ~1/s) simply lands the ramp in fewer, larger steps.
 *
 * A ramp that is interrupted never calls `done`, so whatever was meant to
 * happen at the bottom of a fade — a pause, a rewind — is abandoned with it.
 */
function rampTo(track: MusicTrack, target: number, ms: number, done?: () => void): void {
	stopFade(track)
	const el = players[track]
	if (!el) return
	const from = el.volume
	if (from === target) {
		done?.()
		return
	}
	const start = performance.now()
	fades[track] = setInterval(() => {
		const t = Math.min((performance.now() - start) / ms, 1)
		el.volume = from + (target - from) * t
		if (t < 1) return
		stopFade(track)
		done?.()
	}, FADE_TICK_MS) as unknown as number
}

/** Sends a track back to its opening bar. */
function rewind(el: HTMLAudioElement): void {
	try {
		el.currentTime = 0
	} catch {
		// A browser that will not seek an element it has not loaded yet. The
		// track plays from wherever it is; nothing downstream depends on 0:00.
	}
}

/**
 * The element for a track, built on first use.
 *
 * The element points straight at the file. Handing it a `blob:` URL instead
 * hides the track from download-manager extensions that watch for media
 * elements, and that was tried here — but it does not stop the ones that watch
 * the network instead, because the file still has to cross it as an `.mp3`.
 * It bought nothing those extensions could not see around, at the cost of
 * holding every track's bytes in memory for the session. Not worth it.
 */
function player(track: MusicTrack): HTMLAudioElement | null {
	if (typeof Audio !== 'function') return null
	let el = players[track]
	if (!el) {
		el = new Audio(TRACKS[track].src)
		el.loop = true
		el.preload = 'auto'
		// Silent until a ramp brings it up, so a track that starts playing before
		// its crossfade is scheduled cannot blurt out at full level first.
		el.volume = 0
		players[track] = el
	}
	return el
}

/**
 * Starts a track and fades it up to its level.
 *
 * Separate from `setMusic` because the game-over theme reaches this a beat
 * later than the cue that asked for it — see there.
 */
function bringIn(track: MusicTrack): void {
	const el = player(track)
	if (!el) return
	// From the top only while it is inaudible. Rewinding a track the player can
	// still hear is a click, and a quick there-and-back should not stutter.
	if (TRACKS[track].fromTop && (el.paused || el.volume < 0.01)) rewind(el)
	if (musicMuted) {
		el.volume = 0
		el.pause()
		return
	}
	if (el.paused) el.volume = 0
	// Built and loading, which is all the boot screen needs from it. It is
	// started inside the press (see `applyMusic`) and heard from `powerOn`.
	if (booting) return
	// A rejected play() means the first gesture has not happened yet. `current`
	// stays set, and `unlockAudio` comes back for it.
	void el.play().catch(() => undefined)
	rampTo(track, TRACKS[track].gain, CROSSFADE_MS)
}

/**
 * Puts every track where `current` and the mute switch say it should be.
 *
 * `hard` cuts straight there, for the mute switch — a switch is a switch, not a
 * fade. Without it, a track with a ramp in flight is left alone: that ramp is a
 * crossfade in progress, and stepping on its volume mid-flight is exactly what
 * turns the handover into a jump. This runs on every press (through
 * `unlockAudio`), so those presses must not be able to cut one short.
 */
function applyMusic(hard = false): void {
	for (const track of TRACK_NAMES) {
		const el = players[track]
		if (!el) continue
		if (hard) stopFade(track)
		const wanted = track === current && !musicMuted
		if (fades[track] !== undefined) {
			// The ramp owns the volume, but not whether the element is running: this
			// may be the gesture that lets a refused play() finally through.
			if (wanted) void el.play().catch(() => undefined)
			continue
		}
		el.volume = wanted && !booting ? TRACKS[track].gain : 0
		if (wanted) {
			// Behind the boot screen the press still starts the track — muted, so
			// nothing is heard under the loading bar. What matters is that play()
			// was called inside a gesture: that is what lets `powerOn` unmute it
			// later from a timer, which Safari would otherwise refuse.
			if (booting) el.muted = true
			void el.play().catch(() => undefined)
		}
		// Paused where it stands, not rewound: `fromTop` decides at the next cue
		// whether that track begins again or picks up.
		else el.pause()
	}
}

/**
 * Says which track the cabinet should be playing. Idempotent, so a screen can
 * assert its own as often as it likes.
 *
 * Changes are crossfades: the outgoing track ramps down while the incoming one
 * ramps up over the same `CROSSFADE_MS`, so nothing ever stops dead. Silence
 * (`'off'`) is the same move with nothing coming in.
 *
 * The music is `<audio>` elements rather than buffers in the graph above: the
 * four run to eight and a half minutes between them, and decoding that to PCM
 * would cost hundreds of megabytes to play back something that needs no
 * scheduling. The cost is that they are ordinary media elements, so the fades
 * here are volume ramps rather than scheduled gain — see `rampTo`.
 *
 * GAME OVER is the one cue that does not always come in at once. When a run
 * ends, the screen fires the `over` hit at the same moment it asks for this
 * music, and a theme arriving underneath that hit muddies both, so the entry is
 * held until the cue has rung out. The wait runs from here rather than from the
 * cue itself because the two are fired by different screens in the same tick,
 * in no guaranteed order, and a fixed offset from either is the same instant.
 *
 * The hold is keyed on coming *from* a run, not on the track: that transition
 * is the only one the hit accompanies. Arriving at the same music any other way
 * — opening the review directly, or coming back to it from the ranking — waits
 * for nothing, because there is no cue to wait for.
 */
export function setMusic(cue: MusicCue): void {
	if (typeof Audio !== 'function') return
	const next = cue === 'off' ? null : cue
	if (next === current) return

	// A held entry belongs to the cue that asked for it; this one replaces it.
	if (held !== null) {
		clearTimeout(held)
		held = null
	}

	const outgoing = current
	current = next

	// Everything that is not the incoming track is sent to silence — not just the
	// one being handed over from. Clicking through screens faster than a
	// crossfade leaves the *previous* outgoing track still audible when the next
	// handover starts, and three tracks at once is mud rather than a crossfade.
	// The one being left gets the full musical handover; a straggler from a
	// change the player has already moved past is dropped quickly instead, fast
	// enough not to pile up and slow enough not to click.
	for (const track of TRACK_NAMES) {
		if (track === next) continue
		// Captured rather than looked up when the ramp lands: by then this track
		// may have been cued again and its element should not be paused.
		const el = players[track]
		// A paused element is already silent; its volume is reset when it is next
		// brought in, so there is nothing here to fade.
		if (!el || el.paused) continue
		rampTo(track, 0, track === outgoing ? CROSSFADE_MS : STRAGGLER_FADE_MS, () => el.pause())
	}
	if (!next) return

	// A run that just ended is the only way in that the `over` hit accompanies.
	if (next === 'gameover' && outgoing === 'play') {
		held = setTimeout(() => {
			held = null
			// Only if it is still wanted — the player may have left in the meantime.
			if (current === 'gameover') bringIn('gameover')
		}, OVER_CUE_MS) as unknown as number
		return
	}
	bringIn(next)
}

/**
 * How far the music the cabinet is currently asking for has loaded, 0 to 1.
 *
 * Read by the boot screen, which holds the cabinet dark until the first track
 * can play without stalling. A theme that arrives in pieces under a title
 * screen is worse than one that arrives a moment late.
 *
 * 1 means there is nothing left to wait for, which is not the same as "a track
 * is loaded": a browser with no `Audio`, a player who has switched the music
 * off, and a screen that asked for silence all report ready, because in none of
 * those cases is anyone waiting on bytes.
 *
 * Deliberately polled rather than hung off `canplaythrough`. The caller wants a
 * number every tick for its bar anyway, so an event would only be a second
 * source of the same fact — and `canplaythrough` on an element that finished
 * buffering before the listener attached never fires at all, which is exactly
 * the case a reload out of cache produces.
 */
export function musicProgress(): number {
	if (typeof Audio !== 'function' || musicMuted || !current) return 1
	const el = players[current]
	// `setMusic` builds the element. Until the effect that calls it has run
	// there is nothing to measure, and nothing has started loading either.
	if (!el) return 0
	// HAVE_ENOUGH_DATA is the browser's own verdict that it can play to the end
	// without stopping, which is the question being asked here. Buffered bytes
	// below only stand in for it while it is still making up its mind.
	if (el.readyState >= 4) return 1
	const { duration, buffered } = el
	if (!Number.isFinite(duration) || duration <= 0 || buffered.length === 0) return 0
	// Held under 1 so that `readyState` above stays the only thing that can
	// report ready: bytes on hand are not the same as bytes decoded.
	return Math.min(buffered.end(buffered.length - 1) / duration, 0.99)
}

/**
 * The boot screen has lifted: bring the music up.
 *
 * Called once, as the reveal starts, so the track fades in with the screen
 * rather than playing under the loading bar. It is rewound first, whatever its
 * `fromTop` says — it has only ever run muted, so the player has heard none of
 * it, and a first visit should hear the opening bar.
 */
export function powerOn(): void {
	if (!booting) return
	booting = false
	for (const track of TRACK_NAMES) {
		const el = players[track]
		if (!el) continue
		// Still at volume 0, so lifting the mute is silent; the ramp in `bringIn` is what
		// the player hears.
		el.muted = false
		if (track === current) rewind(el)
	}
	if (current) bringIn(current)
}
