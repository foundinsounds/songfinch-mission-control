'use client'

import { useState, useEffect, useRef } from 'react'

/**
 * Ordered view hierarchy used to determine slide direction.
 * Views earlier in the list slide LEFT when navigating forward,
 * and RIGHT when navigating backward.
 */
const VIEW_ORDER = [
  'kanban', 'list', 'inbox', 'approvals', 'calendar', 'campaigns', 'analytics',
  'agents', 'content', 'templates', 'abtests', 'scoring', 'skills',
  'batch', 'intelligence', 'workload', 'webhooks',
]

function getDirection(fromKey, toKey) {
  const fromIdx = VIEW_ORDER.indexOf(fromKey)
  const toIdx = VIEW_ORDER.indexOf(toKey)
  // Unknown views default to forward
  if (fromIdx === -1 || toIdx === -1) return 'forward'
  return toIdx > fromIdx ? 'forward' : 'backward'
}

/**
 * Animated view transition wrapper with direction-aware sliding.
 * - Forward navigation: content exits left, new content enters from right
 * - Backward navigation: content exits right, new content enters from left
 * Uses GPU-accelerated transforms via will-change + translate3d.
 */
export default function ViewTransition({ viewKey, children, className = '' }) {
  const [phase, setPhase] = useState('visible') // 'visible' | 'exiting' | 'entering'
  const [currentKey, setCurrentKey] = useState(viewKey)
  const [currentChildren, setCurrentChildren] = useState(children)
  const [direction, setDirection] = useState('forward')
  const timeoutRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    if (viewKey !== currentKey) {
      const dir = getDirection(currentKey, viewKey)
      setDirection(dir)

      // Phase 1: exit animation
      setPhase('exiting')

      // Phase 2: swap content and enter
      timeoutRef.current = setTimeout(() => {
        setCurrentKey(viewKey)
        setCurrentChildren(children)
        setPhase('entering')

        // Phase 3: become visible (double rAF ensures browser has painted the entering state)
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = requestAnimationFrame(() => {
            setPhase('visible')
          })
        })
      }, 120) // Slightly faster exit for snappier feel
    } else {
      // Same key — just update children in place
      setCurrentChildren(children)
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [viewKey, children, currentKey])

  const getTransformClasses = () => {
    switch (phase) {
      case 'exiting':
        return direction === 'forward'
          ? 'opacity-0 -translate-x-3 scale-[0.99]'
          : 'opacity-0 translate-x-3 scale-[0.99]'
      case 'entering':
        return direction === 'forward'
          ? 'opacity-0 translate-x-4 scale-[0.99]'
          : 'opacity-0 -translate-x-4 scale-[0.99]'
      case 'visible':
      default:
        return 'opacity-100 translate-x-0 scale-100'
    }
  }

  return (
    <div
      className={`${className} ${getTransformClasses()} ${phase === 'entering' ? 'animate-view-crossfade' : ''}`}
      style={{
        willChange: phase !== 'visible' ? 'transform, opacity' : 'auto',
        transition: phase === 'visible'
          ? 'opacity 180ms cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 180ms cubic-bezier(0.25, 0.46, 0.45, 0.94)'
          : 'opacity 100ms ease-out, transform 100ms ease-out',
      }}
    >
      {currentChildren}
    </div>
  )
}
