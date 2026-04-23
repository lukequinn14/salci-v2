# SALCI v2 — Project Roadmap

## Phase 1: Foundation (Week 1–2)
**Goal**: Working app skeleton deployed to Vercel with dark theme and navigation

- [ ] Initialize Next.js project with TypeScript + Tailwind
- [ ] Connect GitHub repo to Vercel (auto-deploys on every push)
- [ ] Set up Supabase project + get API keys
- [ ] Build root layout: mobile nav bar, dark theme, SALCI branding
- [ ] Create placeholder pages: Home, Pitchers, Hitters, Analytics
- [ ] Set up `.env.local` with all required keys
- [ ] Deploy Phase 1 to production URL

**Done when**: You can visit a real URL and see a dark-themed app with a nav bar.

---

## Phase 2: Auth + User System (Week 2–3)
**Goal**: Users can sign up, log in, and have a profile

- [ ] Enable Supabase Auth (email/password to start)
- [ ] Create `profiles` table in Supabase with `subscription_tier` column
- [ ] Build Login and Signup pages
- [ ] Add auth middleware to protect future Pro routes
- [ ] Show user avatar/name in nav when logged in
- [ ] Free vs Pro tier logic scaffolded (Pro shows lock icon for now)

**Done when**: You can create an account, log in, and see your name in the nav.

---

## Phase 3: Core Analytics — SALCI Pitchers (Week 3–5)
**Goal**: The main SALCI pitcher card feature, fully functional

- [ ] Port SALCI scoring formula from Python to TypeScript
- [ ] Set up Supabase tables: `pitchers`, `daily_salci_scores`, `game_predictions`
- [ ] Migrate GitHub Actions nightly pipeline to write to Supabase instead of JSON
- [ ] Build `PitcherCard` component with SALCI score, grade, K-line projections
- [ ] Build pitcher list page with sort/filter by date, team, SALCI score
- [ ] Build individual pitcher page `/pitcher/[id]` with full breakdown
- [ ] Add Hitter Matchups section (port from Python hit_likelihood.py)
- [ ] Build Analytics Explorer: interactive charts, team/player comparison tool
- [ ] Add "Yesterday" results tab comparing predictions to actual outcomes
- [ ] SALCI share card generator (html2canvas → PNG download for X posts)

**Done when**: A user can load today's pitchers, see SALCI scores, and download a share card.

---

## Phase 4: Monetization — Pro Tier (Week 5–6)
**Goal**: Pro features locked behind a paywall

- [ ] Integrate Stripe for subscription payments (or Patreon webhook)
- [ ] Define Pro features: full K-line odds, parlay builder, heat maps, historical data
- [ ] Update Supabase RLS policies to enforce Pro access
- [ ] Build upgrade/pricing page
- [ ] Webhook to update `subscription_tier` on successful payment
- [ ] Patreon OAuth integration (optional: link Patreon membership to Pro tier)

**Done when**: Free users see locked Pro content; paying users unlock it automatically.

---

## Phase 5: Polish + PWA (Week 6–8)
**Goal**: App feels native on mobile, fast everywhere

- [ ] Add PWA manifest + service worker (installable on phone home screen)
- [ ] Optimize all images and chart renders for mobile
- [ ] Add loading skeletons on all async pages
- [ ] SEO metadata on all pages
- [ ] Error boundary components for graceful failures
- [ ] Performance audit (Lighthouse score > 85)
- [ ] Custom domain setup on Vercel

**Done when**: You can add SALCI to your iPhone home screen and it feels like a real app.