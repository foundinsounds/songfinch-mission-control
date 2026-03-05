'use client'

// ---- Shimmer Skeletons ----
// Loading placeholders for every section of the dashboard
// Uses CSS shimmer animation for a polished loading state

const shimmerStyle = {
  background: 'linear-gradient(90deg, var(--card-bg, rgba(255,255,255,0.03)) 0%, rgba(255,255,255,0.06) 50%, var(--card-bg, rgba(255,255,255,0.03)) 100%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s ease-in-out infinite',
  borderRadius: 6,
}

// Base skeleton block
export function SkeletonBlock({ width = '100%', height = 16, style = {}, className = '' }) {
  return (
    <div
      className={className}
      style={{
        ...shimmerStyle,
        width,
        height,
        ...style,
      }}
    />
  )
}

// Skeleton text line with random widths
export function SkeletonText({ lines = 3, gap = 8 }) {
  const widths = ['100%', '92%', '78%', '85%', '65%', '90%']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock key={i} height={12} width={widths[i % widths.length]} />
      ))}
    </div>
  )
}

// Task card skeleton
export function SkeletonTaskCard() {
  return (
    <div style={{
      background: 'var(--card-bg, rgba(255,255,255,0.03))',
      border: '1px solid var(--card-border, rgba(255,255,255,0.06))',
      borderRadius: 10,
      padding: 16,
      borderLeft: '3px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <SkeletonBlock width={60} height={18} style={{ borderRadius: 9 }} />
        <SkeletonBlock width={24} height={24} style={{ borderRadius: '50%' }} />
      </div>
      <SkeletonBlock width="80%" height={14} style={{ marginBottom: 8 }} />
      <SkeletonText lines={2} gap={6} />
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        <SkeletonBlock width={50} height={18} style={{ borderRadius: 9 }} />
        <SkeletonBlock width={40} height={18} style={{ borderRadius: 9 }} />
      </div>
    </div>
  )
}

// Kanban column skeleton
export function SkeletonKanbanColumn({ cards = 3 }) {
  return (
    <div style={{
      background: 'var(--card-bg, rgba(255,255,255,0.02))',
      borderRadius: 12,
      padding: 16,
      minWidth: 280,
      flex: 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <SkeletonBlock width={100} height={18} />
        <SkeletonBlock width={24} height={18} style={{ borderRadius: 9 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: cards }).map((_, i) => (
          <SkeletonTaskCard key={i} />
        ))}
      </div>
    </div>
  )
}

// Full kanban board skeleton
export function SkeletonKanban() {
  return (
    <div style={{ display: 'flex', gap: 16, overflow: 'hidden' }}>
      <SkeletonKanbanColumn cards={3} />
      <SkeletonKanbanColumn cards={2} />
      <SkeletonKanbanColumn cards={1} />
      <SkeletonKanbanColumn cards={2} />
    </div>
  )
}

// Stats header skeleton
export function SkeletonStats() {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '0 16px' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{
          background: 'var(--card-bg, rgba(255,255,255,0.03))',
          borderRadius: 10,
          padding: '12px 20px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          alignItems: 'center',
        }}>
          <SkeletonBlock width={40} height={28} />
          <SkeletonBlock width={60} height={10} />
        </div>
      ))}
    </div>
  )
}

// Agent sidebar skeleton
export function SkeletonAgentList({ count = 5 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          background: 'var(--card-bg, rgba(255,255,255,0.03))',
          borderRadius: 8,
        }}>
          <SkeletonBlock width={32} height={32} style={{ borderRadius: '50%' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <SkeletonBlock width={70} height={12} />
            <SkeletonBlock width={100} height={10} />
          </div>
          <SkeletonBlock width={8} height={8} style={{ borderRadius: '50%' }} />
        </div>
      ))}
    </div>
  )
}

// Feed item skeleton
export function SkeletonFeedItem() {
  return (
    <div style={{
      display: 'flex',
      gap: 10,
      padding: '10px 12px',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <SkeletonBlock width={28} height={28} style={{ borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <SkeletonBlock width="60%" height={12} />
        <SkeletonBlock width="90%" height={10} />
        <SkeletonBlock width="40%" height={10} />
      </div>
    </div>
  )
}

// Activity feed skeleton
export function SkeletonFeed({ items = 5 }) {
  return (
    <div>
      {Array.from({ length: items }).map((_, i) => (
        <SkeletonFeedItem key={i} />
      ))}
    </div>
  )
}

// Content card skeleton
export function SkeletonContentCard() {
  return (
    <div style={{
      background: 'var(--card-bg, rgba(255,255,255,0.03))',
      border: '1px solid var(--card-border, rgba(255,255,255,0.06))',
      borderRadius: 10,
      padding: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <SkeletonBlock width={80} height={20} style={{ borderRadius: 10 }} />
        <SkeletonBlock width={50} height={20} style={{ borderRadius: 10 }} />
      </div>
      <SkeletonBlock width="70%" height={16} style={{ marginBottom: 8 }} />
      <SkeletonText lines={3} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        <SkeletonBlock width={60} height={12} />
        <SkeletonBlock width={60} height={12} />
      </div>
    </div>
  )
}

// Analytics chart placeholder
export function SkeletonChart({ height = 200 }) {
  return (
    <div style={{
      background: 'var(--card-bg, rgba(255,255,255,0.03))',
      border: '1px solid var(--card-border, rgba(255,255,255,0.06))',
      borderRadius: 12,
      padding: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <SkeletonBlock width={120} height={16} />
        <SkeletonBlock width={80} height={24} style={{ borderRadius: 6 }} />
      </div>
      <div style={{
        height,
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        paddingTop: 10,
      }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonBlock
            key={i}
            width="100%"
            height={`${30 + Math.random() * 60}%`}
            style={{ borderRadius: '4px 4px 0 0' }}
          />
        ))}
      </div>
    </div>
  )
}

export default SkeletonBlock
