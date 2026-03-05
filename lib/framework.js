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
export const QUALITY_RUBRIC = `
## Content Quality Review Rubric

Score each dimension 1-5, then provide an overall verdict.

### 1. Narrative Ladder Compliance (1-5)
- 5: Perfect sequence — emotion first, insight second, impact third, Songfinch last
- 3: Mostly correct but Songfinch appears too early or insight is weak
- 1: Leads with product features or reverses the ladder

### 2. Emotional Depth (1-5)
- 5: Creates a vivid, specific human moment that makes you FEEL something
- 3: Generic emotional language without specificity
- 1: Reads like a product description with emotion words sprinkled in

### 3. Human Insight (1-5)
- 5: Captures a universal truth that makes the reader think "that's so true"
- 3: Has a general observation but nothing surprising
- 1: No real human insight — just marketing copy

### 4. Brand Voice (1-5)
- 5: Feels authentic, warm, specific, and never salesy
- 3: Acceptable but could be any brand's content
- 1: Generic, corporate, or too product-focused

### 5. Platform Appropriateness (1-5)
- 5: Perfectly native to the target platform (length, tone, format)
- 3: Would work on the platform but isn't optimized
- 1: Wrong format or tone for the platform

### 6. Production Readiness (1-5)
- 5: Could be published immediately with minimal editing
- 3: Needs some editing but structure is solid
- 1: Needs major rework

### Verdict Rules
- Average 4.0+ → APPROVE (move to Done)
- Average 3.0-3.9 → APPROVE WITH NOTES (move to Done, save improvement notes to memory)
- Average 2.0-2.9 → REVISE (send back with specific feedback)
- Average below 2.0 → REJECT AND REVISE (send back with detailed rewrite instructions)
`
