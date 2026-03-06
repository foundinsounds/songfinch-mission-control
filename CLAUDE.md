# Songfinch Mission Control — "Roundtable"

Multi-agent AI marketing orchestration platform. 10 AI agents produce content across campaigns, reviewed by CHIEF, orchestrated via Airtable.

## Stack
- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS 3
- **Backend**: Next.js API routes (all `export const dynamic = 'force-dynamic'`)
- **Database**: Airtable (tables: Mission Queue, Agents, Activity Feed, Content Library, Goals, Agent Memory)
- **AI Providers**: Claude (primary) → OpenAI (fallback) → Gemini (tertiary) — see `lib/ai.js`
- **Deployment**: Vercel Pro, `npx vercel --prod --yes` to deploy
- **Notifications**: Slack via webhook — see `lib/slack.js`
- **Cron**: Vercel Cron every 15min (`/api/cron/run-agents`), daily digest at 2PM UTC (`/api/cron/daily-digest`)

## The 10 Agents
CMO (strategist), CHIEF (quality reviewer), MUSE (creative), HOOK (headlines/CTAs), PULSE (social media), LENS (visual), STORY (narratives), SCOUT (research/SEO), FLOW (email/landing pages), PIXEL (ad copy)

## Architecture Decisions
- **All API routes are GET-only** for Vercel Cron compatibility (cron can only call GET)
- **Auth pattern**: `Authorization: Bearer {CRON_SECRET}` or `x-cron-secret` header or `?key=` query param
- **AI fallback chain**: Always try Claude → OpenAI → Gemini. Never hardcode a single provider.
- **Airtable lib** (`lib/airtable.js`): Central data layer. All table access goes through exported functions (getTasks, getAgents, getAllActivity, getContent, getGoals, getAgentMemory, etc.)
- **Goals table may 403**: The Airtable token may lack Goals permissions. Always use `.catch(() => [])` when fetching goals.
- **maxDuration**: Heavy endpoints use `export const maxDuration = 300` (Vercel Pro limit). Lighter ones use 60.
- **Rate limiting**: Global middleware (`middleware.js`) enforces per-route limits via `lib/rateLimit.js`. Skips health checks and authenticated cron/webhook requests.
- **Input validation**: All POST routes use `safeJsonParse()` from `lib/api-utils.js` for safe request body parsing.
- **Error handling**: Fire-and-forget operations (activity logs, Slack, Drive) use `.catch(err => console.warn('[LABEL]...'))` with prefixed labels — never silent `.catch(() => {})`.
- **No test suite**: This project has no tests. Don't try to run them.

## Key Files
- `lib/airtable.js` — All Airtable CRUD operations
- `lib/ai.js` — Multi-provider AI with fallback chain
- `lib/agents.js` — Agent definitions and system prompts
- `lib/framework.js` — Core pipeline orchestration (task assignment, execution, review)
- `lib/api-utils.js` — Shared utilities: `safeJsonParse()`, `validateRequired()`, `apiError()`
- `lib/rateLimit.js` — In-memory sliding window rate limiter with per-route configs
- `lib/slack.js` — Slack notification helpers
- `lib/escalation.js` — Error recovery and self-healing
- `middleware.js` — Global rate limiting middleware for all `/api/*` routes
- `app/page.js` — Main dashboard (massive file, imports ~50 components)
- `components/AgentSidebar.jsx` — Agent status panel (large component)
- `vercel.json` — Cron configuration

## API Route Map

### Core Pipeline
- `/api/cron/run-agents` — Main 15-min cron: assigns tasks, runs agents, reviews
- `/api/cron/daily-digest` — Daily Slack summary
- `/api/pipeline/trigger` — Manual pipeline trigger
- `/api/pipeline/rebalance` — Workload rebalancer (Gini coefficient equity)
- `/api/pipeline/stats` — Pipeline statistics
- `/api/pipeline/history` — Execution history

### Analytics
- `/api/analytics` — Overall analytics dashboard
- `/api/analytics/agents` — Per-agent performance metrics
- `/api/analytics/trends` — Time-series trend data
- `/api/analytics/ab-test` — A/B test analysis (agent performance by content type)
- `/api/analytics/campaigns` — Campaign ROI estimation
- `/api/analytics/calendar` — Content calendar with gap detection
- `/api/analytics/predict` — Predictive quality scoring
- `/api/analytics/bottlenecks` — Pipeline bottleneck detection & health score
- `/api/analytics/freshness` — Content freshness/staleness tracking
- `/api/analytics/collaboration` — Agent collaboration & synergy detection
- `/api/analytics/specializations` — Agent skill tracking

### Task Operations
- `/api/tasks/create` — Create tasks
- `/api/tasks/update` — Update task status/fields
- `/api/tasks/delegate` — Reassign tasks between agents
- `/api/tasks/duplicate` — Clone tasks
- `/api/tasks/feedback` — Submit feedback on task output
- `/api/tasks/comments` — Task comment thread

### Agents
- `/api/agents/chat` — Agent DM and Council messaging with real AI responses

### Other
- `/api/data` — Main data endpoint (tasks, agents, activity)
- `/api/health` + `/api/health/pipeline` — Health checks
- `/api/stats` — Quick stats
- `/api/review/auto` — Auto-review pipeline
- `/api/webhooks` + `/api/webhooks/inbound` — Webhook management
- `/api/slack/test` — Send test Slack notification
- `/api/goals` — Goal CRUD
- `/api/memory` — Agent memory operations
- `/api/content` + `/api/content/performance` — Content library
- `/api/generate/batch` + `/api/generate/image` + `/api/generate/video` — Content generation
- `/api/intelligence` — Council intelligence analytics
- `/api/campaigns/plan` — Campaign planning

## Environment Variables (in Vercel)
```
AIRTABLE_API_KEY — Airtable personal access token
AIRTABLE_BASE_ID — Airtable base ID
OPENAI_API_KEY — OpenAI API key (for GPT-4o and DALL-E 3)
ANTHROPIC_API_KEY — Claude API key
GOOGLE_AI_KEY — Gemini API key (note: NOT GOOGLE_AI_API_KEY)
CRON_SECRET — Auth secret for cron/pipeline endpoints
SLACK_WEBHOOK_URL — Slack incoming webhook URL
GOOGLE_DRIVE_CREDENTIALS — Google Drive service account JSON (for export)
```

## Deployment
```bash
cd "/Users/gugumax/Documents/Claude code/songfinch-mission-control"
git add <files> && git commit -m "message"
git push origin master
npx vercel --prod --yes
```
Production URL: `https://songfinch-mission-control.vercel.app`
Vercel project ID: `prj_pQOXY68ZyC8Quqc6HIBHQsIwbf7N`
Vercel team ID: `team_zCJJLel6DAfyVE7ciIR2hNhZ`

## Conventions
- API routes always return `NextResponse.json(...)` with `generatedAt` timestamp
- Error responses: `{ error: err.message }` with status 500
- Console errors prefixed with endpoint name: `[CAMPAIGNS]`, `[BOTTLENECKS]`, etc.
- Activity feed actions: `assigned`, `generated`, `revised`, `approved`, `rebalanced`
- Quality scores extracted from activity details via regex: `/\((\d+\.?\d*)\/5\)/`
- Content types: Blog Post, Social Media Post, Email Newsletter, Landing Page, Video Script, Ad Copy, Product Description, Case Study, Press Release, SEO Article
- Task statuses: Planned → Assigned → In Progress → Review → Done

## Known Issues
- Goals table may return 403 from Airtable — always wrap getGoals() with .catch(() => [])
- No authentication on dashboard — it's internal-only
- Some components are very large (AgentSidebar ~800 lines, page.js ~2000 lines)
