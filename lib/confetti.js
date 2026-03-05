/**
 * Lightweight DOM-based confetti burst — no canvas, no dependencies.
 * Spawns colorful particles that fall and fade out, then auto-cleanup.
 */

const COLORS = [
  '#f97316', '#22c55e', '#3b82f6', '#eab308', '#ef4444',
  '#a855f7', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1',
]

const SHAPES = ['circle', 'square', 'triangle']

function randomBetween(min, max) {
  return Math.random() * (max - min) + min
}

/**
 * Fire a confetti burst from the center-top of the viewport.
 * @param {Object} opts
 * @param {number} [opts.particleCount=60] — number of particles
 * @param {number} [opts.duration=2500] — animation duration in ms
 * @param {number} [opts.spread=120] — horizontal spread in degrees
 */
export function fireConfetti({ particleCount = 60, duration = 2500, spread = 120 } = {}) {
  if (typeof document === 'undefined') return

  const container = document.createElement('div')
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 9999;
    overflow: hidden;
  `
  document.body.appendChild(container)

  // Inject keyframes if not already present
  if (!document.getElementById('confetti-keyframes')) {
    const style = document.createElement('style')
    style.id = 'confetti-keyframes'
    style.textContent = `
      @keyframes confetti-fall {
        0% {
          transform: translate(var(--confetti-x0), var(--confetti-y0)) rotate(0deg) scale(1);
          opacity: 1;
        }
        50% {
          opacity: 1;
        }
        100% {
          transform: translate(var(--confetti-x1), var(--confetti-y1)) rotate(var(--confetti-rot)) scale(0.3);
          opacity: 0;
        }
      }
    `
    document.head.appendChild(style)
  }

  const centerX = window.innerWidth / 2
  const startY = window.innerHeight * 0.3

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div')
    const color = COLORS[Math.floor(Math.random() * COLORS.length)]
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)]
    const size = randomBetween(6, 12)
    const angle = randomBetween(-spread / 2, spread / 2) * (Math.PI / 180)
    const velocity = randomBetween(200, 600)

    const x0 = centerX - size / 2
    const y0 = startY
    const x1 = x0 + Math.sin(angle) * velocity
    const y1 = y0 + Math.cos(angle) * velocity + randomBetween(100, 400)
    const rot = randomBetween(-720, 720)
    const delay = randomBetween(0, 200)
    const dur = duration + randomBetween(-400, 400)

    let borderRadius = '0'
    let clipPath = 'none'

    if (shape === 'circle') {
      borderRadius = '50%'
    } else if (shape === 'triangle') {
      clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)'
    }

    particle.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: ${borderRadius};
      clip-path: ${clipPath};
      left: 0;
      top: 0;
      --confetti-x0: ${x0}px;
      --confetti-y0: ${y0}px;
      --confetti-x1: ${x1}px;
      --confetti-y1: ${y1}px;
      --confetti-rot: ${rot}deg;
      animation: confetti-fall ${dur}ms cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}ms forwards;
      will-change: transform, opacity;
    `

    container.appendChild(particle)
  }

  // Cleanup after animation completes
  setTimeout(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container)
    }
  }, duration + 600)
}
