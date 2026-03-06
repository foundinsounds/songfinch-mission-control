'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

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
 *
 * IMPORTANT: Animation logic is isolated from children-sync logic.
 * The animation effect only depends on `viewKey` to prevent parent
 * re-renders (data polling, state updates) from canceling in-flight
 * animations via the useEffect cleanup function.
 */
export default function ViewTransition({ viewKey, children, className = '' }) {
  const [phase, setPhase] = useState('visible') // 'visible' | 'exiting' | 'entering'
  const [displayKey, setDisplayKey] = useState(viewKey)
  const [displayChildren, setDisplayChildren] = useState(children)
  const [direction, setDirection] = useState('forward')
  const timeoutRef = useRef(null)
  const rafRef = useRef(null)
  const animatingRef = useRef(false)
  const prevKeyRef = useRef(viewKey)
  // Store latest children in a ref so the animation timeout can capture
  // the freshest version without needing children in the dep array
  const childrenRef = useRef(children)
  childrenRef.current = children

  // ── Effect 1: Animation — only triggered by viewKey changes ──
  // This effect does NOT include `children` in its dependencies,
  // so parent re-renders from data fetches/polling won't cancel
  // the animation timers via cleanup.
  useEffect(() => {
    if (viewKey === prevKeyRef.current) return // No actual view change

    const dir = getDirection(prevKeyRef.current, viewKey)
    setDirection(dir)
    animatingRef.current = true

    // Cancel any in-progress animation (handles rapid view switching)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    // Phase 1: exit current view
    setPhase('exiting')

    // Phase 2: swap content and slide in new view
    timeoutRef.current = setTimeout(() => {
      prevKeyRef.current = viewKey
      setDisplayKey(viewKey)
      setDisplayChildren(childrenRef.current) // Use ref for freshest children
      setPhase('entering')

      // Phase 3: become visible (double rAF ensures browser has painted the entering state)
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => {
          setPhase('visible')
          animatingRef.current = false
        })
      })
    }, 120) // Slightly faster exit for snappier feel

    // NO cleanup here — we don't want parent re-renders to cancel the animation.
    // Cancellation only happens at the top of this effect for rapid view switching.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey])

  // ── Effect 2: Children sync — update displayed content for same-view re-renders ──
  // When the parent re-renders with fresh data (polling, state updates) but the
  // view hasn't changed, silently update the displayed children.
  useEffect(() => {
    if (!animatingRef.current && viewKey === displayKey) {
      setDisplayChildren(children)
    }
  })

  // ── Effect 3: Cleanup on unmount only ──
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const getTransformClasses = useCallback(() => {
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
  }, [phase, direction])

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
      {displayChildren}
    </div>
  )
}
