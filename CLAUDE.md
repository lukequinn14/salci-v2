# CLAUDE.md — SALCI v2 Project Context

This file is the source of truth for every Claude Code session.
Read this before writing any code. Never delete it.

---

## What This Is

SALCI v2 is a Next.js web application delivering MLB pitching and hitting analytics.
The core feature is the SALCI score (Strikeout Adjusted Lineup Confidence Index),
which predicts pitcher strikeout performance using Statcast data. The app targets
mobile-first users (PWA) and scales to full desktop analytics dashboards.
Shareable card images are posted to X under @SALCI with #SALCI.

---

## Tech Stack

- Framework: Next.js 14, App Router only (use app/ directory, never pages/)
- Language: TypeScript — all files must be .ts or .tsx, never .js
- Styling: Tailwind CSS — utility classes only, no custom CSS files unless necessary
- Backend/DB: Supabase (PostgreSQL + Auth + Realtime + Row-Level Security)
- Charts: Recharts with ResponsiveContainer on every chart for mobile
- Icons: lucide-react
- Deployment: Vercel (auto-deploys on every GitHub push)
- Share cards: html2canvas (client-side PNG generation for X posts)

---

## Project Structuresalci-v2/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (nav, footer, dark theme)
│   │   ├── page.tsx                # Home / today's dashboard
│   │   ├── pitcher/[id]/page.tsx   # Individual pitcher detail page
│   │   ├── analytics/page.tsx      # Interactive analytics explorer
│   │   └── api/                    # Server-side API routes
│   │       ├── pitchers/route.ts
│   │       ├── hitters/route.ts
│   │       └── odds/route.ts
│   ├── components/
│   │   ├── ui/                     # Generic: Button, Card, Badge, Spinner
│   │   ├── pitcher/                # PitcherCard, SalciGauge, KLineChart
│   │   ├── hitter/                 # HitterMatchupCard, HitLikelihoodBar
│   │   └── charts/                 # Chart wrappers (always use ResponsiveContainer)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts           # Browser client (Auth only)
│   │   │   └── server.ts           # Server client (data fetching)
│   │   ├── salci/
│   │   │   ├── scoring.ts          # SALCI formula (TypeScript port)
│   │   │   └── grades.ts           # Grade thresholds and floor-minus-2 rule
│   │   ├── mlb-api/
│   │   │   ├── statsapi.ts         # MLB Stats API fetcher
│   │   │   ├── statcast.ts         # Baseball Savant / Statcast fetcher
│   │   │   └── logos.ts            # ESPN CDN logo resolver (see section below)
│   │   └── odds/
│   │       └── fetcher.ts          # Odds API with BallDontLie + API-Sports fallback
│   └── types/
│       ├── pitcher.ts
│       ├── hitter.ts
│       └── salci.ts
├── CLAUDE.md                       # This file
├── ROADMAP.md
├── .env.local                      # Local secrets — never commit
└── .env.example                    # Committed template of required keys

---

## Environment Variables

All keys go in `.env.local` locally and in Vercel's environment settings for production.
Never hardcode any of these anywhere.Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=MLB Data
MLB_STATS_API_BASE=https://statsapi.mlb.com/api/v1
Baseball Savant is scraped via CSV — no key needed, but set a User-Agent headerThe Odds API (primary — 500 requests/month on free tier, use cache aggressively)
THE_ODDS_API_KEY=3840dd63fdf568d0f7d13dd9a079d35a
ODDS_MARKETS=h2h
ODDS_REGIONS=usBallDontLie (live scores fallback)
BALLDONTLIE_API_KEY=e1193300-6bc3-4a8f-a665-132c2d9c4cc2API-Sports (second fallback)
APISPORTS_KEY=af14f621e7ca729de60ed03ab1ed0cd6GitHub (for nightly pipeline writing back to repo or Supabase)
GH_REPO=lukequinn14/SALCI-MLB-4.0

API quota strategy: The Odds API has a 500 req/month limit on free tier.
Always cache odds responses for at minimum 3600 seconds (1 hour).
Only call the live API on explicit user-triggered refresh.
Fallback order: The Odds API → BallDontLie → API-Sports.

---

## Data Sources

### MLB Stats API (statsapi.mlb.com)
- Free, no auth required
- Use for: game schedules, lineups, box scores, player stats
- Cache with: fetch(url, { next: { revalidate: 3600 } })

### Baseball Savant / Statcast (baseballsavant.mlb.com)
- Free, no auth required, but ESPN hotlink protection blocks server fetches
- Fetch the CSV export endpoint server-side, parse results
- Required header: { 'User-Agent': 'Mozilla/5.0' }
- Key endpoint pattern:
  https://baseballsavant.mlb.com/statcast_search/csv?player_type=pitcher&player_id={id}&game_date_gt={start}&game_date_lt={end}

### The Odds API + Fallbacks
- See odds/fetcher.ts — implements quota caching + fallback chain
- Player props endpoint (not h2h) for strikeout lines

---

## MLB Team Logos

Logos are served from ESPN's CDN. The resolver lives in src/lib/mlb-api/logos.ts.

Key rules:
- Standard path:  https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/{slug}.png
- Dark-bg path:   https://a.espncdn.com/i/teamlogos/mlb/500-dark/{slug}.png
- CWS slug is "chw" on ESPN (not "cws") — this is the only non-obvious one
- Use dark-bg variant only when rendering on dark chart backgrounds
- Teams needing dark-bg variant: COL, SD, NYY, MIN, KC, PIT, MIL, CWS, SF
- Always add onerror="this.style.display='none'" on logo img tags
- Server-side fetch of ESPN URLs returns 403 (hotlink protection) — this is expected.
  Render logo URLs in img src tags client-side only.

Abbreviation → ESPN slug map (all 30 teams):
ARI=ari, ATL=atl, BAL=bal, BOS=bos, CHC=chc, CWS=chw, CIN=cin,
CLE=cle, COL=col, DET=det, HOU=hou, KC=kc, LAA=laa, LAD=lad,
MIA=mia, MIL=mil, MIN=min, NYM=nym, NYY=nyy, OAK=oak, PHI=phi,
PIT=pit, SD=sd, SF=sf, SEA=sea, STL=stl, TB=tb, TEX=tex,
TOR=tor, WSH=wsh

Logo rendering in JSX (always wrap in a white circle for visibility):
```tsx<div className="flex items-center justify-center bg-white rounded-full w-9 h-9 shadow-sm">
  <img
    src={getTeamLogoUrl(team, false)}
    alt={team}
    className="w-7 h-7 object-contain"
    onError={(e) => { e.currentTarget.style.display = 'none' }}
  />
</div>
````

## SALCI v4 Scoring Formula

Weights (stuff-dominant, location intentionally de-weighted):
```
stuff:    0.52  — whiff power, arsenal quality, CSW%
matchup:  0.30  — opponent K-propensity + zone contact
workload: 0.10  — opportunity ceiling (projected IP)
location: 0.08  — penalized: extreme command = pitching to contact, not whiffs
```

Key insight: high command HURTS strikeout prediction. The model rewards aggressive,
stuff-heavy pitchers over fine command guys.

SalciScore interface:
```typescript
interface SalciScore {
  stuff: number;        // normalized 6-97
  location: number;     // normalized 35-65 (capped upside)
  matchup: number;      // normalized 15-90
  workload: number;     // normalized 20-85
  total: number;        // final SALCI, clamped 10-95
  grade: 'S' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F';
  floor: number;        // projected K floor
  ceiling: number;      // projected K ceiling
  expectedKs: number;   // Poisson-based mean K projection
  buffer: number;       // volatility buffer (stuff/location gap)
  recommendOver: boolean; // floor >= bookLine + 2
}
```

Floor-minus-2 rule (core, non-negotiable):
Recommend strikeout over when floor >= bookLine + 2

Grade thresholds (v4):
S=80+, A=70-79, B+=60-69, B=52-59, C=44-51, D=35-43, F=<35

Volatility buffer (stuff-location gap drives floor/ceiling spread):
gap>22→2.1, gap>15→1.75, gap>8→1.40, gap<-15→0.80, gap<-8→0.95, else→1.15

See src/lib/salci/scoring.ts for full sigmoid normalization math.

---

## Coding Standards

### TypeScript
- Always type all function parameters and return values
- Use interface for object shapes, type for unions
- No `any` — use `unknown` and narrow it
- Export types from src/types/, not inline in component files

### React Components
- Function components with arrow functions only
- Props typed with interface named ComponentNameProps
- Example:

```tsxinterface PitcherCardProps {
pitcherId: number;
name: string;
team: string;
salci: SalciScore;
}const PitcherCard = ({ pitcherId, name, team, salci }: PitcherCardProps) => {
return <div>...</div>;
};export default PitcherCard;

### File naming
- Components: PascalCase.tsx
- Utilities/lib: kebab-case.ts
- API routes: route.ts inside folder (e.g. app/api/pitchers/route.ts)

### Supabase
- Server client for all data fetching in Server Components
- Browser client only for Auth in Client Components
- RLS always enabled — never bypass with service role on the client
- Never SELECT * — always specify columns

### Data fetching
- Default to Server Components (no 'use client') for all data pages
- Add 'use client' only when you need: useState, useEffect, event handlers
- Use Next.js fetch() with revalidate for MLB API caching

### Styling
- Dark theme by default
- Brand green: Tailwind emerald scale (emerald-400, emerald-500, emerald-600)
- Mobile-first always: base styles for mobile, md: and lg: for larger screens
- Example: className="text-sm md:text-base lg:text-lg"

---

## Do NOT

- Never use the pages/ directory — App Router only
- Never hardcode API keys — always process.env.VARIABLE_NAME
- Never SELECT * from Supabase
- Never skip loading and error states on async components
- Never fetch ESPN logo URLs server-side (403 hotlink protection)
- Never call The Odds API without checking cache first
- Never use 'use client' on a page that only needs to display data