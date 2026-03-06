'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * ScrollToTop — Floating button that appears after scrolling down.
 *
 * - Shows after 300px of scroll
 * - Smooth-scrolls to top of the scrollable container
 * - Positioned bottom-right, above MobileBottomNav on mobile
 * - Uses GPU-accelerated fade + scale transition
 *
 * Props:
 *   scrollContainerRef — optional ref to a scrollable container (defaults to window)
 */
export default function ScrollToTop({ scrollContainerRef }) {
  const [visible, setVisible] = useState(false)

  const handleScroll = useCallback(() => {
    const scrollTop = scrollContainerRef?.current
      ? scrollContainerRef.current.scrollTop
      : window.scrollY || document.documentElement.scrollTop
    setVisible(scrollTop > 300)
  }, [scrollContainerRef])

  useEffect(() => {
    const target = scrollContainerRef?.current || window
    target.addEventListener('scroll', handleScroll, { passive: true })
    return () => target.removeEventListener('scroll', handleScroll)
  }, [handleScroll, scrollContainerRef])

  const scrollToTop = useCallback(() => {
    const target = scrollContainerRef?.current
    if (target) {
      target.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [scrollContainerRef])

  return (
    <button
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className={`fixed z-40 bottom-20 left-4 md:bottom-14 md:left-6 w-10 h-10 rounded-full bg-dark-700/90 backdrop-blur border border-dark-400/50 text-gray-400 hover:text-white hover:bg-dark-600 hover:border-dark-300 shadow-lg shadow-black/30 flex items-center justify-center transition-all duration-200 ${
        visible
          ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
          : 'opacity-0 translate-y-4 scale-75 pointer-events-none'
      }`}
      style={{ willChange: visible ? 'transform, opacity' : 'auto' }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  )
}
