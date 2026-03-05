// Synthesized notification sounds using Web Audio API
// No audio files needed — pure JavaScript waveform generation

let audioCtx = null

function getAudioContext() {
  if (!audioCtx) {
    if (typeof window !== 'undefined' && window.AudioContext) {
      audioCtx = new AudioContext()
    }
  }
  return audioCtx
}

function playTone(frequency, duration = 0.15, type = 'sine', volume = 0.12) {
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

  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + duration)
}

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

// Notification ping — subtle single tone
export function playNotificationSound() {
  playTone(1047, 0.12, 'sine', 0.06)
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
