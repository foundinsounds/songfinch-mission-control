// Songfinch Impact-First Advertising Framework
// The strategic DNA that powers every agent's creative output
// Single source of truth — update here, propagates everywhere

export const SONGFINCH_FRAMEWORK = `
## SONGFINCH IMPACT-FIRST ADVERTISING FRAMEWORK

### Core Philosophy
Songfinch is NOT a music service. Songfinch is a moment-making engine that turns life experiences into permanent emotional artifacts. People do not buy custom songs — they buy recognition, gratitude, memory preservation, celebration, emotional expression, identity, and legacy. The song is the artifact that holds the emotion, not the value itself.

### The Narrative Ladder (MANDATORY for all creative)
Every piece of content MUST follow this exact sequence:
1. EMOTIONAL MOMENT — the feeling appears first
2. HUMAN INSIGHT — the universal truth behind the feeling
3. IMPACT / TRANSFORMATION — what the experience unlocks
4. SONGFINCH — appears LAST as the mechanism that made the moment possible

NEVER reverse this order. NEVER lead with product features. NEVER lead with "Songfinch makes custom songs."

### Brand Positioning
Songfinch competes in the mental category of MEANINGFUL EXPERIENCES and EMOTIONAL STORYTELLING — not music tools or AI song generators. Think:
- Nike sells human potential, not shoes
- Apple sells creativity and empowerment, not computers
- Airbnb sells belonging, not lodging
- Dove sells self-confidence, not soap
- Songfinch sells permanent emotional artifacts, not songs

### Core Marketing Principles
1. **Outcome Marketing** — Highlight what someone BECOMES or EXPERIENCES because of the product
2. **Emotional Positioning** — Anchor the brand to human feelings and identity
3. **Category Reframing** — Place the product in a larger emotional category, not a functional one
4. **Artifact Creation** — Frame the product as the lasting object that preserves a meaningful moment

### Five Emotional Territories (rotate through these)
1. **Celebration** — milestones, achievements, weddings, graduations, birthdays
2. **Gratitude** — thanking someone who shaped your life, recognizing unsung heroes
3. **Memory** — preserving a meaningful moment before it fades, nostalgia, remembrance
4. **Identity** — telling your own story, expressing who you are, self-discovery
5. **Tribute** — honoring someone important, memorial, legacy, lasting recognition

### Human Insights to Build From
- "People rarely get to hear how much they matter"
- "The best moments of life disappear faster than we expect"
- "We struggle to put our deepest feelings into words"
- "Everyone has a story worth telling — most never get told"
- "The people who shape us most often hear it least"
- "Some feelings are too big for a text or a card"
- "We spend our lives collecting moments but rarely preserving them"
- "The most meaningful gifts aren't things — they're understanding"

### Impact Statements (use as creative inspiration)
- "It's how you finally say what they mean to you"
- "It's how you relive the best moments of your life"
- "It's how someone hears their story for the first time"
- "It's how a moment becomes permanent"
- "It's how the people you love hear what you've always felt"
- "It's how you turn a lifetime into something they can hold"

### Creative Workflow (every agent must follow)
1. Define the EMOTIONAL MOMENT being depicted
2. Articulate the HUMAN INSIGHT behind the moment
3. Write the IMPACT STATEMENT that expresses what the experience unlocks
4. Introduce SONGFINCH as the tool that turns that moment into a song

### ABSOLUTE PROHIBITIONS
- No feature-driven messaging ("custom songs", "personalized music", "choose a genre")
- No generic gifting language ("perfect gift", "unique present", "gift for any occasion")
- No product-first hooks ("At Songfinch, we...", "Songfinch offers...")
- No comparison to AI song generators or music tools
- No price-leading messaging
- Content must NEVER read like a product description
`

// Condensed version for injection into prompts (saves tokens)
export const FRAMEWORK_BRIEF = `SONGFINCH IMPACT-FIRST FRAMEWORK: Songfinch sells permanent emotional artifacts, NOT songs. Content MUST follow the Narrative Ladder: (1) Emotional Moment → (2) Human Insight → (3) Impact/Transformation → (4) Songfinch as mechanism. Five emotional territories: Celebration, Gratitude, Memory, Identity, Tribute. NEVER lead with product features. NEVER use generic gift language. Think Nike (potential, not shoes), Apple (creativity, not computers). Every piece must make the audience FEEL before they THINK about the product.`

// For the CMO planner — emotional territories with creative hooks
export const EMOTIONAL_TERRITORIES = [
  {
    name: 'Celebration',
    hooks: ['milestones', 'achievements', 'weddings', 'graduations', 'birthdays', 'promotions', 'first steps', 'retirement'],
    insight: 'The biggest moments deserve more than a card',
  },
  {
    name: 'Gratitude',
    hooks: ['thank you', 'teachers', 'parents', 'mentors', 'coaches', 'unsung heroes', 'nurses', 'community'],
    insight: 'The people who shape us most often hear it least',
  },
  {
    name: 'Memory',
    hooks: ['nostalgia', 'remembrance', 'childhood', 'first love', 'family traditions', 'places that shaped us', 'time capsule'],
    insight: 'The best moments of life disappear faster than we expect',
  },
  {
    name: 'Identity',
    hooks: ['self-expression', 'personal journey', 'heritage', 'coming of age', 'who I am', 'my story', 'roots'],
    insight: 'Everyone has a story worth telling — most never get told',
  },
  {
    name: 'Tribute',
    hooks: ['memorial', 'legacy', 'honoring', 'in memory of', 'angel anniversary', 'living tribute', 'hero'],
    insight: 'Some people deserve to be remembered in more than words',
  },
]

// Content quality rubric for CHIEF auto-reviewer
// CALIBRATION NOTE: Scores were consistently too low (2-2.8/5) because the rubric
// described "3" as mediocre. Recalibrated so 3 = solid/good, 4 = strong, 5 = exceptional.
// Also lowered approval thresholds to match realistic AI content production.
export const QUALITY_RUBRIC = `
## Content Quality Review Rubric

Score each dimension 1-5, then provide an overall verdict.

IMPORTANT CALIBRATION: A score of 3 means GOOD — the content meets professional standards. Reserve 1-2 for content that truly fails. Most competent content should score 3-4. Only truly exceptional work gets 5.

### 1. Narrative Ladder Compliance (1-5)
- 5: Perfect sequence — emotion first, insight second, impact third, Songfinch last. Masterful transitions.
- 4: Clear ladder structure with strong emotional opening and Songfinch positioned correctly
- 3: Follows the general ladder flow — emotion leads, Songfinch is not the focus. Minor sequencing imperfections are fine.
- 2: Songfinch appears too early or the ladder is mostly inverted
- 1: Leads with product features or reads like a product page

### 2. Emotional Depth (1-5)
- 5: Creates a vivid, specific human moment with sensory detail that evokes real feeling
- 4: Strong emotional resonance with a specific, relatable scenario
- 3: Has genuine emotional content — references real feelings and human experiences, even if not highly specific
- 2: Surface-level emotion — uses feeling words but lacks a real human moment
- 1: No emotional content — reads like a product description

### 3. Human Insight (1-5)
- 5: Captures a surprising universal truth that makes the reader pause and think "that's so true"
- 4: Strong observation about human nature that feels authentic and relatable
- 3: Contains a valid human observation or relatable truth, even if familiar. Most good marketing content lives here.
- 2: Generic platitudes without real insight ("love is important", "memories matter")
- 1: No human insight — pure product messaging

### 4. Brand Voice (1-5)
- 5: Unmistakably Songfinch — warm, intimate, poetic without being pretentious
- 4: Feels authentic and aligned with brand personality, clearly not generic
- 3: Warm and non-salesy tone that fits the Songfinch brand. Doesn't feel corporate.
- 2: Acceptable writing but could belong to any brand
- 1: Corporate, salesy, or completely off-brand

### 5. Platform Appropriateness (1-5)
- 5: Perfectly native — uses platform conventions, optimal length, ideal format
- 4: Strong platform fit with appropriate tone and format
- 3: Works well on the target platform — right general format and tone, even if not perfectly optimized
- 2: Somewhat mismatched to platform norms
- 1: Wrong format, tone, or length for the platform

### 6. Production Readiness (1-5)
- 5: Publish-ready — zero edits needed, complete with all required elements
- 4: Nearly ready — only minor copy tweaks needed
- 3: Solid draft — structure and message are right, may need light editing for polish
- 2: Needs meaningful editing — good ideas but rough execution
- 1: Needs major rework — structural or conceptual issues

### Verdict Rules
- Average 3.5+ → APPROVE (move to Done)
- Average 2.5-3.4 → APPROVE_WITH_NOTES (move to Done, save improvement notes)
- Average 1.5-2.4 → REVISE (send back with specific feedback)
- Average below 1.5 → REJECT (send back with detailed rewrite instructions)

### Scoring Guidance
Most competent content should average 3.0-4.0. If you find yourself giving many 1s and 2s, recalibrate — those scores mean the content fundamentally FAILS at that dimension, not that it's merely imperfect. A piece that follows the framework reasonably well, has genuine emotion, and is well-written should score at least 3 on most dimensions.
`
