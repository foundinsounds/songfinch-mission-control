// Seed API — Populates Airtable "Mission Queue" with starter tasks
// so the autonomous agent pipeline has real work to process.
//
// POST /api/seed — Creates tasks in Airtable (auth required)
// GET  /api/seed — Preview/dry-run of tasks that would be created (no auth)

import { createTask } from '../../../lib/airtable'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Auth — mirrors the pattern in /api/cron/run-agents
// ---------------------------------------------------------------------------

function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true // No secret configured = open (dev mode)

  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${cronSecret}`) return true

  const url = new URL(request.url)
  if (url.searchParams.get('key') === cronSecret) return true

  return false
}

// ---------------------------------------------------------------------------
// Seed task definitions
// ---------------------------------------------------------------------------
// Each task uses Airtable field names (PascalCase with spaces).
// Agent is null so the cron runner's auto-assignment engine handles routing.
// ---------------------------------------------------------------------------

const SEED_TASKS = [
  // ===== IMAGE TASKS (3) — Trigger DALL-E generation via PIXEL agent =====
  {
    'Task Name': 'Father\'s Day Hero Banner — "The Song He Never Expected"',
    'Description':
      'Create a hero banner image for the Father\'s Day campaign landing page. ' +
      'Visual concept: A father sitting in his favorite chair, headphones on, eyes closed, ' +
      'overcome with emotion as he listens to a custom Songfinch song for the first time. ' +
      'Warm golden-hour lighting. The moment of surprise and deep feeling. ' +
      'Territory: Gratitude. Style: Cinematic, warm, emotionally rich. ' +
      'Dimensions: 1920x1080 for website hero, with safe zones for text overlay on the left third.',
    'Status': 'Inbox',
    'Content Type': 'Image',
    'Platform': ['Website'],
    'Campaign': 'Father\'s Day 2025',
    'Priority': 'High',
    'Emotional Pillar': ['Gratitude'],
    'Agent': null,
  },
  {
    'Task Name': 'Instagram Carousel Graphic — Wedding Season Testimonials',
    'Description':
      'Design a set of Instagram carousel graphics (1080x1080) for wedding season. ' +
      'Each slide features a real couple quote overlaid on a soft, romantic visual. ' +
      'Slide 1: Cover with headline "Their First Dance. Her Words. His Song." ' +
      'Slide 2-4: Individual couple testimonials with subtle floral/celebration imagery. ' +
      'Slide 5: CTA slide with Songfinch branding. ' +
      'Territory: Celebration. Color palette: blush, ivory, gold accents. ' +
      'Typography should feel elegant but modern.',
    'Status': 'Inbox',
    'Content Type': 'Image',
    'Platform': ['Instagram'],
    'Campaign': 'Wedding Season',
    'Priority': 'High',
    'Emotional Pillar': ['Celebration'],
    'Agent': null,
  },
  {
    'Task Name': 'Facebook Ad Visual — Graduation Gift Retargeting',
    'Description':
      'Create a Facebook ad image (1200x628) for retargeting users who visited the graduation landing page ' +
      'but didn\'t purchase. Visual concept: A graduate in cap and gown, tears streaming, ' +
      'holding a phone playing their custom song while family surrounds them. ' +
      'The image should capture the exact moment of emotional impact. ' +
      'Territory: Identity. Text overlay: minimal, just enough to spark curiosity. ' +
      'Must comply with Facebook\'s 20% text rule.',
    'Status': 'Inbox',
    'Content Type': 'Image',
    'Platform': ['Facebook'],
    'Campaign': 'Graduation 2025',
    'Priority': 'Medium',
    'Emotional Pillar': ['Identity'],
    'Agent': null,
  },

  // ===== VIDEO SCRIPT TASKS (2) — For LENS agent =====
  {
    'Task Name': 'TikTok Video Script — "Watch Dad Hear His Song"',
    'Description':
      'Write a 30-second TikTok video script capturing a real gift-giving moment. ' +
      'Format: Hook (0-3s) → Build (3-15s) → Emotional Peak (15-25s) → CTA (25-30s). ' +
      'Hook: "We secretly wrote a song about my dad using his own stories..." ' +
      'Build: Quick cuts of the family recording voice memos, selecting an artist, the song being created. ' +
      'Peak: Dad listening for the first time, the exact moment he realizes it\'s about him. ' +
      'CTA: "Every story deserves a song. Link in bio." ' +
      'Territory: Gratitude. Tone: authentic, unpolished, real — NOT corporate. ' +
      'Include shot-by-shot direction, on-screen text suggestions, and music/SFX notes.',
    'Status': 'Inbox',
    'Content Type': 'Video Script',
    'Platform': ['TikTok', 'Instagram'],
    'Campaign': 'Father\'s Day 2025',
    'Priority': 'High',
    'Emotional Pillar': ['Gratitude'],
    'Agent': null,
  },
  {
    'Task Name': 'YouTube Pre-Roll Script — Memorial Tribute Campaign',
    'Description':
      'Write a 15-second non-skippable YouTube pre-roll ad script for the Tribute campaign. ' +
      'Concept: A woman sits alone, playing a custom Songfinch tribute song for her late mother. ' +
      'She mouths the words, smiles through tears. The song captures a specific memory — ' +
      'Sunday morning pancakes, the smell of her perfume, the way she always said goodnight. ' +
      'Voiceover (warm, intimate): "Some people leave. Their stories don\'t have to." ' +
      'End card: Songfinch logo + "Commission a tribute song." ' +
      'Territory: Tribute. Must work WITHOUT sound (include visual storytelling notes). ' +
      'Include a 6-second bumper cut variant.',
    'Status': 'Inbox',
    'Content Type': 'Video Script',
    'Platform': ['YouTube'],
    'Campaign': 'Tribute Collection',
    'Priority': 'Medium',
    'Emotional Pillar': ['Tribute'],
    'Agent': null,
  },

  // ===== AD COPY TASKS (3) — For HOOK agent =====
  {
    'Task Name': 'Facebook/Instagram Ad Copy — Father\'s Day Conversion Campaign',
    'Description':
      'Write 5 ad copy variations for a Facebook/Instagram conversion campaign targeting ' +
      'women 25-45 who are searching for meaningful Father\'s Day gifts. ' +
      'Each variation should follow the Narrative Ladder: Emotion first, product last. ' +
      'Include: Primary text (125 chars max), Headline (40 chars), Description (30 chars), CTA button text. ' +
      'Variation angles: (1) The dad who "has everything" (2) Long-distance dad (3) New dad ' +
      '(4) Dad who never shows emotion (5) Stepdad/father figure. ' +
      'Territory: Gratitude. Avoid: generic gift language, "unique gift", "perfect present". ' +
      'Each ad should make the scroller STOP and FEEL something specific.',
    'Status': 'Inbox',
    'Content Type': 'Ad Copy',
    'Platform': ['Facebook', 'Instagram'],
    'Campaign': 'Father\'s Day 2025',
    'Priority': 'High',
    'Emotional Pillar': ['Gratitude'],
    'Agent': null,
  },
  {
    'Task Name': 'Google Search Ads — Wedding Gift Keywords',
    'Description':
      'Write responsive search ad copy for wedding-related keyword groups: ' +
      '"unique wedding gift", "gift for bride from groom", "wedding day surprise", ' +
      '"personalized wedding song", "custom song for wedding". ' +
      'Include 15 headlines (30 chars each) and 4 descriptions (90 chars each) per ad group. ' +
      'Headlines should mix emotional hooks with practical value props. ' +
      'Territory: Celebration. Include sitelink extension copy for: How It Works, Listen to Examples, ' +
      'Artist Stories, Pricing. Pin certain headlines for relevance.',
    'Status': 'Inbox',
    'Content Type': 'Ad Copy',
    'Platform': ['Website'],
    'Campaign': 'Wedding Season',
    'Priority': 'Medium',
    'Emotional Pillar': ['Celebration'],
    'Agent': null,
  },
  {
    'Task Name': 'Retargeting Ad Copy — Cart Abandonment Sequence',
    'Description':
      'Write a 3-email retargeting sequence for users who started the Songfinch order process ' +
      'but didn\'t complete checkout. ' +
      'Email 1 (Day 1): Gentle reminder with emotional hook — "Your song is still waiting to be written." ' +
      'Email 2 (Day 3): Social proof — share a testimonial about a recipient\'s reaction. ' +
      'Email 3 (Day 5): Urgency + empathy — "The moment you\'re imagining? Let\'s make it real." ' +
      'Each email: Subject line (A/B), preview text, body copy, CTA. ' +
      'Territory: Memory. Tone: warm, personal, zero pressure. Max 150 words per email body.',
    'Status': 'Inbox',
    'Content Type': 'Ad Copy',
    'Platform': ['Email'],
    'Campaign': 'Retargeting',
    'Priority': 'Medium',
    'Emotional Pillar': ['Memory'],
    'Agent': null,
  },

  // ===== SOCIAL POST TASKS (2) — For PULSE agent =====
  {
    'Task Name': 'Instagram Reels Content Calendar — Emotional Moments Series',
    'Description':
      'Create a 2-week Instagram Reels content calendar (10 posts) for the "Emotional Moments" series. ' +
      'Each post captures a different gifting occasion and the recipient\'s reaction. ' +
      'Format per post: Hook text, Visual concept, On-screen text sequence, Caption (with hashtags), ' +
      'Posting time recommendation, Audio suggestion (trending sounds or original). ' +
      'Mix of occasions: birthday, anniversary, graduation, "just because", apology, memorial, proposal. ' +
      'Territory: Mix all 5 pillars across the calendar. ' +
      'Every post must make someone say "I need to do this for someone I love."',
    'Status': 'Inbox',
    'Content Type': 'Social Post',
    'Platform': ['Instagram'],
    'Campaign': 'Content Marketing',
    'Priority': 'High',
    'Emotional Pillar': ['Celebration', 'Gratitude', 'Memory'],
    'Agent': null,
  },
  {
    'Task Name': 'Twitter/X Thread — "The Psychology of Musical Gifts"',
    'Description':
      'Write a 10-tweet thread exploring the science and emotion behind why music triggers deeper ' +
      'emotional responses than physical gifts. ' +
      'Tweet 1: Hook with a surprising stat or question. ' +
      'Tweets 2-8: Each explores one angle — neuroscience of music + memory, why personalization matters, ' +
      'the "effort signal" of commissioning art, the permanence of a song vs. a physical object, ' +
      'case study of a Songfinch recipient reaction. ' +
      'Tweet 9: Bridge to Songfinch (subtle, not salesy). ' +
      'Tweet 10: CTA — "Whose story deserves a song?" ' +
      'Territory: Identity. Each tweet must stand alone AND flow as a narrative. Max 280 chars each.',
    'Status': 'Inbox',
    'Content Type': 'Social Post',
    'Platform': ['Twitter/X'],
    'Campaign': 'Brand Awareness',
    'Priority': 'Low',
    'Emotional Pillar': ['Identity'],
    'Agent': null,
  },

  // ===== BLOG POST / SEO CONTENT (1) — For STORY/FLOW agent =====
  {
    'Task Name': 'SEO Blog Post — "50 Custom Song Ideas for Every Life Moment"',
    'Description':
      'Write a comprehensive, SEO-optimized blog post (2,000-2,500 words) targeting the keyword cluster: ' +
      '"custom song ideas", "personalized song gift", "original song for [occasion]". ' +
      'Structure: Introduction (emotional hook, not keyword-stuffed) → 50 ideas organized by category: ' +
      'Romantic (15), Family (10), Friendship (8), Milestones (7), Memorial/Tribute (5), Just Because (5). ' +
      'Each idea: 2-3 sentences describing the specific moment + how a custom song elevates it. ' +
      'Include internal linking suggestions, meta description, H2/H3 structure, and featured snippet targets. ' +
      'Territory: All pillars. Tone: inspiring, practical, emotionally rich. ' +
      'This should rank AND make people cry.',
    'Status': 'Inbox',
    'Content Type': 'SEO Content',
    'Platform': ['Blog', 'Website'],
    'Campaign': 'SEO',
    'Priority': 'Medium',
    'Emotional Pillar': ['Celebration', 'Gratitude', 'Memory', 'Identity', 'Tribute'],
    'Agent': null,
  },

  // ===== LANDING PAGE (1) — For FLOW agent =====
  {
    'Task Name': 'Landing Page Copy — Father\'s Day Gift Guide',
    'Description':
      'Write full landing page copy for the Father\'s Day gift guide page. ' +
      'Structure: Hero section (headline + subhead + CTA) → "Why a Song?" section with 3 emotional proof points → ' +
      'How It Works (3-step process, keep it simple) → Social Proof (testimonial placeholders with direction) → ' +
      'Artist Spotlight teaser → Pricing section (frame as investment in a memory, not a transaction) → ' +
      'FAQ (6 questions) → Final CTA section. ' +
      'Territory: Gratitude. The page should feel like a conversation, not a sales pitch. ' +
      'Every section must answer "Why should I care?" before "What is it?" ' +
      'Include mobile-specific copy considerations. Target conversion rate: 4%+.',
    'Status': 'Inbox',
    'Content Type': 'Landing Page',
    'Platform': ['Website'],
    'Campaign': 'Father\'s Day 2025',
    'Priority': 'High',
    'Emotional Pillar': ['Gratitude'],
    'Agent': null,
  },

  // ===== ARTIST SPOTLIGHT (1) — For STORY agent =====
  {
    'Task Name': 'Artist Spotlight — "Meet the Songwriter Behind 500 Love Stories"',
    'Description':
      'Write an Artist Spotlight feature (800-1,000 words) profiling a Songfinch songwriter ' +
      'who has created over 500 custom songs. ' +
      'Angle: Not a profile about the ARTIST — a profile about the STORIES they\'ve been entrusted with. ' +
      'Structure: Opening scene (the artist receiving a particularly moving brief) → ' +
      'What it\'s like to hold someone\'s deepest memories → The hardest song they ever wrote (a tribute) → ' +
      'The most joyful (a proposal) → What they\'ve learned about love from strangers → ' +
      'Closing: How every song teaches them something about being human. ' +
      'Territory: Memory + Identity. Include pull-quote suggestions and social media excerpt. ' +
      'This should read like a mini-documentary transcript, not a Q&A.',
    'Status': 'Inbox',
    'Content Type': 'Artist Spotlight',
    'Platform': ['Blog', 'Email'],
    'Campaign': 'Brand Awareness',
    'Priority': 'Medium',
    'Emotional Pillar': ['Memory', 'Identity'],
    'Agent': null,
  },

  // ===== STRATEGY / RESEARCH (1) — For CMO/SCOUT agent =====
  {
    'Task Name': 'Competitive Audit — Personalized Gift Market Q3 2025',
    'Description':
      'Conduct a competitive landscape audit of the personalized/experiential gift market. ' +
      'Analyze direct competitors (Cameo, Memmo, Tribute) and adjacent players (Uncommon Goods, Etsy custom sellers). ' +
      'For each: Positioning statement, primary audience, pricing model, content strategy, ' +
      'social media presence strength, key differentiator. ' +
      'Then: Songfinch\'s whitespace opportunities — where are competitors weak? ' +
      'What emotional territories are UNCLAIMED? Which platforms are underserved? ' +
      'Deliverable: Executive summary (1 page), detailed matrix (comparison table), ' +
      '3 strategic recommendations with projected impact. ' +
      'Territory: All. This feeds into Q3 campaign planning.',
    'Status': 'Inbox',
    'Content Type': 'Strategy',
    'Platform': ['Website'],
    'Campaign': 'Brand Awareness',
    'Priority': 'Low',
    'Emotional Pillar': ['Celebration', 'Gratitude', 'Memory', 'Identity', 'Tribute'],
    'Agent': null,
  },

  // ===== ADDITIONAL IMAGE TASK for variety =====
  {
    'Task Name': 'Email Header Graphic — Tribute Collection Launch',
    'Description':
      'Create an email header image (600x200) for the Tribute Collection product launch email. ' +
      'Visual concept: Soft, luminous imagery evoking remembrance — perhaps a candle flame reflected ' +
      'in a vinyl record, or hands holding a phone with sound waves drifting upward like smoke. ' +
      'Territory: Tribute. Color palette: deep navy, soft gold, warm white. ' +
      'Must work on both light and dark email backgrounds. ' +
      'The image should feel reverent but not somber — honoring, not mourning. ' +
      'No text in the image itself (text will be HTML overlaid).',
    'Status': 'Inbox',
    'Content Type': 'Image',
    'Platform': ['Email'],
    'Campaign': 'Tribute Collection',
    'Priority': 'Medium',
    'Emotional Pillar': ['Tribute'],
    'Agent': null,
  },
]

// ---------------------------------------------------------------------------
// GET — Dry-run preview (no auth required)
// ---------------------------------------------------------------------------

export async function GET() {
  const tasks = SEED_TASKS.map((task, i) => ({
    index: i + 1,
    name: task['Task Name'],
    contentType: task['Content Type'],
    platform: task['Platform'],
    campaign: task['Campaign'],
    priority: task['Priority'],
    emotionalPillar: task['Emotional Pillar'],
  }))

  const summary = {
    totalTasks: tasks.length,
    byContentType: countBy(SEED_TASKS, 'Content Type'),
    byPriority: countBy(SEED_TASKS, 'Priority'),
    byCampaign: countBy(SEED_TASKS, 'Campaign'),
    byPillar: countByArray(SEED_TASKS, 'Emotional Pillar'),
  }

  return NextResponse.json({
    message: 'Dry-run preview — these tasks would be created on POST.',
    summary,
    tasks,
  })
}

// ---------------------------------------------------------------------------
// POST — Seed tasks into Airtable (auth required)
// ---------------------------------------------------------------------------

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse optional body
  let body = {}
  try {
    body = await request.json()
  } catch {
    // No body or invalid JSON — use defaults
  }

  const {
    count = SEED_TASKS.length,
    includeImages = true,
    includeVideos = true,
  } = body

  // Filter tasks based on options
  let tasksToSeed = [...SEED_TASKS]

  if (!includeImages) {
    tasksToSeed = tasksToSeed.filter(t => t['Content Type'] !== 'Image')
  }
  if (!includeVideos) {
    tasksToSeed = tasksToSeed.filter(t => t['Content Type'] !== 'Video Script')
  }

  // Limit count
  tasksToSeed = tasksToSeed.slice(0, Math.min(count, SEED_TASKS.length))

  const created = []
  const errors = []

  // Create tasks sequentially to avoid Airtable rate limits (5 req/sec)
  for (const task of tasksToSeed) {
    try {
      const result = await createTask(task)
      created.push({
        name: task['Task Name'],
        contentType: task['Content Type'],
        recordId: result.records?.[0]?.id || null,
      })
    } catch (err) {
      errors.push({
        name: task['Task Name'],
        error: err.message,
      })
      console.error(`[SEED] Failed to create "${task['Task Name']}":`, err.message)
    }

    // Small delay to respect Airtable's 5 requests/second rate limit
    await sleep(250)
  }

  const summary = {
    requested: tasksToSeed.length,
    created: created.length,
    failed: errors.length,
    byContentType: countBy(
      tasksToSeed.filter((_, i) => i < created.length),
      'Content Type'
    ),
  }

  console.log(
    `[SEED] Seeded ${created.length}/${tasksToSeed.length} tasks (${errors.length} errors)`
  )

  return NextResponse.json({
    message: `Seeded ${created.length} tasks into Mission Queue.`,
    summary,
    created,
    errors: errors.length > 0 ? errors : undefined,
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function countBy(tasks, field) {
  const counts = {}
  for (const task of tasks) {
    const value = task[field] || 'Unknown'
    counts[value] = (counts[value] || 0) + 1
  }
  return counts
}

function countByArray(tasks, field) {
  const counts = {}
  for (const task of tasks) {
    const values = task[field] || []
    for (const v of values) {
      counts[v] = (counts[v] || 0) + 1
    }
  }
  return counts
}
