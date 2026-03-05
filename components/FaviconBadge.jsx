'use client'

import { useEffect, useRef } from 'react'

/**
 * FaviconBadge - Headless component that shows review task count
 * as a badge on the browser tab favicon and in document.title.
 *
 * Renders nothing (returns null). Side effects only via useEffect.
 */
export default function FaviconBadge({ tasks }) {
  const originalFavicon = useRef(null)
  const originalTitle = useRef(null)
  const lastCount = useRef(-1)

  useEffect(() => {
    if (typeof document === 'undefined') return

    // Store originals on first mount
    if (originalTitle.current === null) {
      originalTitle.current = document.title
    }
    if (originalFavicon.current === null) {
      const existingLink = document.querySelector("link[rel*='icon']")
      originalFavicon.current = existingLink ? existingLink.href : '/favicon.ico'
    }

    const count = Array.isArray(tasks)
      ? tasks.filter((t) => t.status === 'Review').length
      : 0

    // Debounce: skip if count hasn't changed
    if (count === lastCount.current) return
    lastCount.current = count

    if (count === 0) {
      // Restore original favicon
      let link = document.querySelector("link[rel*='icon']")
      if (link) {
        link.href = originalFavicon.current
      }
      // Restore original title
      document.title = originalTitle.current
      return
    }

    // Update document.title with count prefix
    const baseTitle = originalTitle.current
    document.title = `(${count}) ${baseTitle}`

    // Create canvas and draw badge on favicon
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = originalFavicon.current

    img.onload = () => {
      ctx.drawImage(img, 0, 0, 32, 32)

      // Draw red badge circle
      const badgeSize = count > 9 ? 16 : 14
      ctx.fillStyle = '#ef4444'
      ctx.beginPath()
      ctx.arc(32 - badgeSize / 2, badgeSize / 2, badgeSize / 2, 0, 2 * Math.PI)
      ctx.fill()

      // Draw white count text
      ctx.fillStyle = '#ffffff'
      ctx.font = `bold ${count > 9 ? 9 : 10}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(
        count > 99 ? '99+' : String(count),
        32 - badgeSize / 2,
        badgeSize / 2 + 1
      )

      // Update favicon link element
      let link = document.querySelector("link[rel*='icon']")
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = canvas.toDataURL('image/png')
    }

    // Fallback: if the image fails to load, still show badge on blank canvas
    img.onerror = () => {
      // Draw badge on empty canvas
      const badgeSize = count > 9 ? 16 : 14
      ctx.fillStyle = '#ef4444'
      ctx.beginPath()
      ctx.arc(32 - badgeSize / 2, badgeSize / 2, badgeSize / 2, 0, 2 * Math.PI)
      ctx.fill()

      ctx.fillStyle = '#ffffff'
      ctx.font = `bold ${count > 9 ? 9 : 10}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(
        count > 99 ? '99+' : String(count),
        32 - badgeSize / 2,
        badgeSize / 2 + 1
      )

      let link = document.querySelector("link[rel*='icon']")
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = canvas.toDataURL('image/png')
    }
  }, [tasks])

  // Cleanup on unmount: restore originals
  useEffect(() => {
    return () => {
      if (typeof document === 'undefined') return

      if (originalFavicon.current) {
        const link = document.querySelector("link[rel*='icon']")
        if (link) {
          link.href = originalFavicon.current
        }
      }
      if (originalTitle.current) {
        document.title = originalTitle.current
      }
    }
  }, [])

  return null
}
