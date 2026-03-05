// Synthesized notification sounds using Web Audio API
// No audio files needed — pure JavaScript waveform generation

let audioCtx = null

const VOLUME_STORAGE_KEY = 'roundtable-sound-volume'
const MUTE_STORAGE_KEY = 'roundtable-sound-muted'

// ─── Volume Control System ───────────────────────────────────────────

/**
 * Get the current volume level from localStorage.
 * Returns a value from the set: 0, 0.25, 0.5, 0.75, 1.0
 * Defaults to 0.5 if not set.
 */
export function getSoundVolume() {
  if (typeof window === 'undefined') return 0.5
  const stored = localStorage.getItem(VOLUME_STORAGE_KEY)
  if (stored === null) return 0.5
  const val = parseFloat(stored)
  // Clamp to valid levels
  const levels = [0, 0.25, 0.5, 0.75, 1.0]
  const closest = levels.reduce((prev, curr) =>
    Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev
  )
  return closest
}

/**
 * Set the volume level. Accepted values: 0, 0.25, 0.5, 0.75, 1.0
 */
export function setSoundVolume(level) {
  if (typeof window === 'undefined') return
  const levels = [0, 0.25, 0.5, 0.75, 1.0]
  const closest = levels.reduce((prev, curr) =>
    Math.abs(curr - level) < Math.abs(prev - level) ? curr : prev
  )
  localStorage.setItem(VOLUME_STORAGE_KEY, String(closest))
}

/**
 * Check if sound is enabled (not muted).
 */
export function isSoundEnabled() {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(MUTE_STORAGE_KEY) !== 'true'
}

/**
 * Toggle the master mute. Returns the new enabled state.
 */
export function toggleSound() {
  if (typeof window === 'undefined') return true
  const currentlyMuted = localStorage.getItem(MUTE_STORAGE_KEY) === 'true'
  localStorage.setItem(MUTE_STORAGE_KEY, String(!currentlyMuted))
  return currentlyMuted // returns new enabled state (was muted, now enabled)
}

// ─── Audio Engine ────────────────────────────────────────────────────

function getAudioContext() {
  if (!audioCtx) {
    if (typeof window !== 'undefined' && window.AudioContext) {
      audioCtx = new AudioContext()
    }
  }
  return audioCtx
}

/**
 * Compute the effective volume for a tone, combining the base volume
 * with the global volume setting and mute state.
 */
function effectiveVolume(baseVolume) {
  if (!isSoundEnabled()) return 0
  const globalVolume = getSoundVolume()
  if (globalVolume === 0) return 0
  return baseVolume * globalVolume
}

function playTone(frequency, duration = 0.15, type = 'sine', volume = 0.12) {
  const vol = effectiveVolume(volume)
  if (vol <= 0) return

  const ctx = getAudioContext()
  if (!ctx) return

  // Resume context if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') ctx.resume()

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.type = type
  osc.frequency.setValueAtTime(frequency, ctx.currentTime)

  gain.gain.setValueAtTime(vol, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + duration)
}

/**
 * Play a tone with a frequency sweep (used for futuristic effects).
 * Sweeps from startFreq to endFreq over the duration.
 */
function playToneSweep(startFreq, endFreq, duration = 0.15, type = 'sine', volume = 0.12) {
  const vol = effectiveVolume(volume)
  if (vol <= 0) return

  const ctx = getAudioContext()
  if (!ctx) return

  if (ctx.state === 'suspended') ctx.resume()

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.type = type
  osc.frequency.setValueAtTime(startFreq, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration)

  gain.gain.setValueAtTime(vol, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + duration)
}

// ─── Original Sounds ─────────────────────────────────────────────────

// Approval — bright ascending double-ping
export function playApproveSound() {
  playTone(880, 0.1, 'sine', 0.1)
  setTimeout(() => playTone(1320, 0.15, 'sine', 0.1), 100)
}

// Task completed — satisfying triple ascending chime
export function playCompleteSound() {
  playTone(523, 0.12, 'sine', 0.08)
  setTimeout(() => playTone(659, 0.12, 'sine', 0.08), 100)
  setTimeout(() => playTone(784, 0.18, 'sine', 0.1), 200)
}

// Error / Request Changes — low descending tone
export function playErrorSound() {
  playTone(440, 0.12, 'triangle', 0.1)
  setTimeout(() => playTone(330, 0.2, 'triangle', 0.1), 120)
}

// New task created — quick pop
export function playCreateSound() {
  playTone(660, 0.08, 'sine', 0.1)
  setTimeout(() => playTone(880, 0.1, 'sine', 0.08), 60)
}

// Drag drop — soft thud
export function playDropSound() {
  playTone(200, 0.08, 'triangle', 0.1)
  setTimeout(() => playTone(300, 0.06, 'sine', 0.06), 40)
}

// Status change — gentle slide
export function playStatusChangeSound() {
  playTone(440, 0.1, 'sine', 0.06)
  setTimeout(() => playTone(550, 0.1, 'sine', 0.06), 80)
}

// ─── New Sounds ──────────────────────────────────────────────────────

// Notification — pleasant two-tone chime (replaces the old single-ping)
export function playNotificationSound() {
  playTone(1047, 0.1, 'sine', 0.07)
  setTimeout(() => playTone(1319, 0.14, 'sine', 0.06), 90)
}

// Warning — lower alert tone for warnings/escalations
export function playWarningSound() {
  playTone(330, 0.14, 'triangle', 0.1)
  setTimeout(() => playTone(294, 0.18, 'triangle', 0.09), 130)
}

// Success chain — ascending arpeggio (3 quick notes) for dependency chain completions
export function playSuccessChainSound() {
  playTone(523, 0.08, 'sine', 0.08)   // C5
  setTimeout(() => playTone(659, 0.08, 'sine', 0.08), 70)   // E5
  setTimeout(() => playTone(784, 0.08, 'sine', 0.08), 140)   // G5
  setTimeout(() => playTone(1047, 0.16, 'sine', 0.1), 210)   // C6 — resolving high note
}

// Agent start — futuristic "boot up" sweep with a confirming ping
export function playAgentStartSound() {
  playToneSweep(200, 800, 0.18, 'sawtooth', 0.06)
  setTimeout(() => playTone(880, 0.1, 'sine', 0.08), 180)
}

// Agent complete — satisfying "task done" flourish (descending to resolving major chord)
export function playAgentCompleteSound() {
  playTone(784, 0.1, 'sine', 0.08)    // G5
  setTimeout(() => playTone(988, 0.1, 'sine', 0.08), 80)    // B5
  setTimeout(() => playTone(1175, 0.1, 'sine', 0.09), 160)  // D6
  setTimeout(() => playTone(1568, 0.22, 'sine', 0.1), 240)  // G6 — triumphant resolve
}
