'use client'

import { useEffect, useRef } from 'react'

/**
 * TabNotification — Updates browser tab title with unread count badge
 * Shows: "(3) Mission Control" when there are review items pending
 * Flashes tab title for urgent items (optional)
 *
 * Usage:
 *   <TabNotification count={reviewCount} baseTitle="Mission Control" />
 */
export default function TabNotification({
  count = 0,
  baseTitle = 'Mission Control',
  urgentThreshold = 5,
  flashInterval = 2000,
}) {
  const originalTitle = useRef(baseTitle)
  const flashTimer = useRef(null)

  useEffect(() => {
    // Clean up on unmount
    return () => {
      document.title = originalTitle.current
      if (flashTimer.current) clearInterval(flashTimer.current)
    }
  }, [])

  useEffect(() => {
    // Clear any existing flash
    if (flashTimer.current) {
      clearInterval(flashTimer.current)
      flashTimer.current = null
    }

    if (count <= 0) {
      document.title = baseTitle
      // Update favicon to normal
      updateFavicon(false)
      return
    }

    const badgeTitle = `(${count}) ${baseTitle}`
    document.title = badgeTitle
    updateFavicon(true, count)

    // Flash tab title for urgent counts
    if (count >= urgentThreshold) {
      let isFlash = false
      flashTimer.current = setInterval(() => {
        isFlash = !isFlash
        document.title = isFlash ? `\u{1F534} ${count} items need review!` : badgeTitle
      }, flashInterval)
    }

    return () => {
      if (flashTimer.current) clearInterval(flashTimer.current)
    }
  }, [count, baseTitle, urgentThreshold, flashInterval])

  return null // This component renders nothing — it's a side-effect component
}

/**
 * Dynamically update favicon with notification badge
 * Creates a small red circle with count on top of the existing favicon
 */
function updateFavicon(showBadge, count = 0) {
  if (typeof document === 'undefined') return

  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext('2d')

  // Draw base favicon (simple circle logo)
  ctx.fillStyle = '#f97316' // accent-orange
  ctx.beginPath()
  ctx.arc(16, 16, 12, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#0a0a1a'
  ctx.beginPath()
  ctx.arc(16, 16, 8, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#f97316'
  ctx.beginPath()
  ctx.arc(16, 16, 3, 0, Math.PI * 2)
  ctx.fill()

  if (showBadge && count > 0) {
    // Draw red badge circle
    ctx.fillStyle = '#ef4444'
    ctx.beginPath()
    ctx.arc(24, 8, 8, 0, Math.PI * 2)
    ctx.fill()

    // Draw count text
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 10px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(count > 9 ? '9+' : String(count), 24, 8)
  }

  // Apply favicon
  let link = document.querySelector("link[rel~='icon']")
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = canvas.toDataURL('image/png')
}
