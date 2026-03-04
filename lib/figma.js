// Figma REST API helper — pulls design context for PIXEL agent
// Requires FIGMA_TOKEN environment variable

const FIGMA_TOKEN = process.env.FIGMA_TOKEN

async function figmaFetch(endpoint) {
  if (!FIGMA_TOKEN) {
    throw new Error('FIGMA_TOKEN not configured')
  }

  const res = await fetch(`https://api.figma.com/v1${endpoint}`, {
    headers: {
      'X-FIGMA-TOKEN': FIGMA_TOKEN,
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Figma API error: ${res.status} - ${error}`)
  }

  return res.json()
}

/**
 * Parse a Figma URL into fileKey and nodeId
 * Supports: https://figma.com/design/:fileKey/:fileName?node-id=1-2
 *           https://www.figma.com/file/:fileKey/:fileName?node-id=1-2
 */
export function parseFigmaUrl(url) {
  if (!url) return null
  const match = url.match(/figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)/)
  if (!match) return null

  const fileKey = match[1]
  const nodeMatch = url.match(/node-id=([^&]+)/)
  const nodeId = nodeMatch ? nodeMatch[1].replace('-', ':') : null

  return { fileKey, nodeId }
}

/**
 * Get file metadata (name, pages, components)
 */
export async function getFileInfo(fileKey) {
  const data = await figmaFetch(`/files/${fileKey}?depth=1`)
  return {
    name: data.name,
    lastModified: data.lastModified,
    version: data.version,
    pages: data.document?.children?.map(p => ({
      id: p.id,
      name: p.name,
      type: p.type,
    })) || [],
  }
}

/**
 * Get node details — styles, layout, text content
 */
export async function getNodeInfo(fileKey, nodeId) {
  const data = await figmaFetch(`/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}&depth=3`)
  const node = data.nodes?.[nodeId]
  if (!node) return null

  return {
    name: node.document?.name,
    type: node.document?.type,
    children: flattenNode(node.document),
    styles: node.styles || {},
  }
}

/**
 * Get design tokens — colors, typography, spacing from a node tree
 */
function flattenNode(node, depth = 0) {
  if (!node || depth > 5) return []
  const result = []

  const entry = {
    name: node.name,
    type: node.type,
  }

  // Extract size
  if (node.absoluteBoundingBox) {
    entry.width = Math.round(node.absoluteBoundingBox.width)
    entry.height = Math.round(node.absoluteBoundingBox.height)
  }

  // Extract text
  if (node.type === 'TEXT') {
    entry.text = node.characters
    if (node.style) {
      entry.fontSize = node.style.fontSize
      entry.fontFamily = node.style.fontFamily
      entry.fontWeight = node.style.fontWeight
      entry.lineHeight = node.style.lineHeightPx
      entry.letterSpacing = node.style.letterSpacing
    }
  }

  // Extract fills (colors)
  if (node.fills && node.fills.length > 0) {
    entry.fills = node.fills
      .filter(f => f.type === 'SOLID' && f.visible !== false)
      .map(f => ({
        r: Math.round(f.color.r * 255),
        g: Math.round(f.color.g * 255),
        b: Math.round(f.color.b * 255),
        a: f.opacity ?? f.color.a ?? 1,
      }))
  }

  // Extract layout
  if (node.layoutMode) {
    entry.layout = {
      mode: node.layoutMode,
      gap: node.itemSpacing,
      padding: {
        top: node.paddingTop,
        right: node.paddingRight,
        bottom: node.paddingBottom,
        left: node.paddingLeft,
      },
    }
  }

  // Extract corner radius
  if (node.cornerRadius) {
    entry.borderRadius = node.cornerRadius
  }

  result.push(entry)

  // Recurse into children
  if (node.children) {
    for (const child of node.children) {
      result.push(...flattenNode(child, depth + 1))
    }
  }

  return result
}

/**
 * Get component set info (variants, properties)
 */
export async function getComponents(fileKey) {
  const data = await figmaFetch(`/files/${fileKey}/components`)
  return (data.meta?.components || []).map(c => ({
    key: c.key,
    name: c.name,
    description: c.description,
    containingFrame: c.containing_frame?.name,
  }))
}

/**
 * Get design styles (colors, text styles, effects)
 */
export async function getStyles(fileKey) {
  const data = await figmaFetch(`/files/${fileKey}/styles`)
  return (data.meta?.styles || []).map(s => ({
    key: s.key,
    name: s.name,
    type: s.style_type,
    description: s.description,
  }))
}

/**
 * Build a design context string for the PIXEL agent prompt
 * Pulls file info, node details, components, and styles
 */
export async function buildDesignContext(figmaUrl) {
  const parsed = parseFigmaUrl(figmaUrl)
  if (!parsed) return null

  const sections = [`## Figma Design Context\n**File Key:** ${parsed.fileKey}`]

  try {
    // Get file info
    const fileInfo = await getFileInfo(parsed.fileKey)
    sections.push(`**File:** ${fileInfo.name}`)
    sections.push(`**Pages:** ${fileInfo.pages.map(p => p.name).join(', ')}`)

    // Get styles (design tokens)
    try {
      const styles = await getStyles(parsed.fileKey)
      if (styles.length > 0) {
        sections.push('\n### Design Tokens')
        const colorStyles = styles.filter(s => s.type === 'FILL')
        const textStyles = styles.filter(s => s.type === 'TEXT')
        if (colorStyles.length > 0) {
          sections.push('**Colors:** ' + colorStyles.map(s => s.name).join(', '))
        }
        if (textStyles.length > 0) {
          sections.push('**Typography:** ' + textStyles.map(s => s.name).join(', '))
        }
      }
    } catch {}

    // Get components
    try {
      const components = await getComponents(parsed.fileKey)
      if (components.length > 0) {
        sections.push('\n### Components Available')
        components.slice(0, 20).forEach(c => {
          sections.push(`- **${c.name}**${c.description ? `: ${c.description}` : ''} (in ${c.containingFrame || 'root'})`)
        })
      }
    } catch {}

    // Get specific node if provided
    if (parsed.nodeId) {
      try {
        const nodeInfo = await getNodeInfo(parsed.fileKey, parsed.nodeId)
        if (nodeInfo) {
          sections.push(`\n### Selected Node: ${nodeInfo.name} (${nodeInfo.type})`)
          const elements = nodeInfo.children || []
          elements.slice(0, 30).forEach(el => {
            let desc = `- **${el.name}** [${el.type}]`
            if (el.width && el.height) desc += ` ${el.width}x${el.height}`
            if (el.text) desc += ` — "${el.text.substring(0, 60)}"`
            if (el.fontSize) desc += ` (${el.fontFamily} ${el.fontSize}px)`
            if (el.fills?.length > 0) {
              const c = el.fills[0]
              desc += ` color: rgb(${c.r},${c.g},${c.b})`
            }
            if (el.layout) desc += ` layout: ${el.layout.mode} gap:${el.layout.gap}px`
            if (el.borderRadius) desc += ` radius: ${el.borderRadius}px`
            sections.push(desc)
          })
        }
      } catch {}
    }

    return sections.join('\n')
  } catch (err) {
    return `## Figma Context\nFailed to load: ${err.message}`
  }
}

/**
 * Check if Figma integration is available
 */
export function isFigmaConfigured() {
  return !!FIGMA_TOKEN
}
