'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * useTheme — manages dark/light theme state with localStorage persistence
 * and DOM attribute synchronization.
 *
 * Extracted from page.js to isolate theming concerns.
 *
 * How it works:
 *  - Stores preference in localStorage('roundtable-theme')
 *  - Sets data-theme attribute on <html> for CSS selectors
 *  - Adds/removes 'light' class on <html> for Tailwind overrides
 */
export function useTheme() {
  const [theme, setTheme] = useState('dark')

  // Initialize from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('roundtable-theme') || 'dark'
    setTheme(saved)
    document.documentElement.setAttribute('data-theme', saved)
    if (saved === 'light') {
      document.documentElement.classList.add('light')
    }
  }, [])

  // Toggle between dark ↔ light
  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem('roundtable-theme', next)
      document.documentElement.setAttribute('data-theme', next)
      if (next === 'light') {
        document.documentElement.classList.add('light')
      } else {
        document.documentElement.classList.remove('light')
      }
      return next
    })
  }, [])

  return { theme, toggleTheme }
}
