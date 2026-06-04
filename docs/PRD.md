# SkillForge — Product Requirements Document

**Version:** 1.0 (sprint 39 — live web/PWA pilot)
**Positioning:** "Level up through proof, not promises."
**Tagline:** "Stop watching. Start building."
**Audience:** Anyone who wants to grow their skills — any field, any level. Not just tech professionals.

> **Status (sprint 39):** This PRD captures the product vision and core loop. The **current shipping reality** is a **live web/PWA pilot** on Netlify (`fascinating-kitten-b6a79d.netlify.app`) with Supabase cloud backup (ARCH-001 shipped). The live source of truth for release decisions and backlog is `reports/skillforge-audit-report.md`. Phase 2 items (live community feed, real leaderboard, AI share posts) remain planned.

---

## Problem

Tech professionals have no structured way to track the proof that they're growing. They watch tutorials but can't show it. They build projects but lose track of them. They have no identity that evolves with their skills — and no community that recognizes the work.

LinkedIn shows a static resume. GitHub shows code. But nothing shows the *journey*.

---

## Core Differentiator

**Proof-Based Progression.**

XP comes from creation, not consumption.

| ❌ Not this | ✅ This |
|---|---|
| "I watched a Python course" | "I built an ETL pipeline with Pandas" |
| "I'm learning Snowflake" | "I completed a Snowflake data pipeline" |
| "I read a book" | "I finished Atomic Habits and extracted 14 insights" |

This creates professional identity, portfolio value, and credibility.

---

## Core User Loop

```
Learn → Build → Log Output → Gain XP → Unlock Milestone → Share → Receive Recognition → Repeat
```

This is the addiction loop. Every feature should serve it.

---

## User Personas

**Primary: The Ambitious Data Professional**
- Works in data engineering, analytics, or ML
- Actively upskilling toward a senior role or career pivot
- Already posts on LinkedIn, follows data influencers
- Frustrated that their growth isn't visible or measurable

**Secondary: The AI Learner**
- Self-taught, learning LLMs, prompt engineering, AI agents
- Building projects to prove competence to employers
- Wants a portfolio but doesn't know how to present it

---

## Features — MVP

### 1. Career Evolution Map (Main Screen)

The emotional anchor of the app. A visual skill tree showing the user's path toward a career goal.

**Behavior:**
- User selects a career path on onboarding (Data Architect, AI Engineer, etc.)
- Map shows all skill nodes in that path
- Each node has three states:
  - ✅ **Complete** — all required outputs logged, XP earned, milestone unlocked
  - 🔄 **In Progress** — at least one output logged, progress bar visible
  - 🔒 **Locked** — prerequisite skill not yet complete
- Tapping a node opens a detail sheet showing logged outputs and what's needed to complete
- An overall "Evolution %" is displayed at the top (e.g., "Data Architect — 32% Complete")

**Success metric:** Users return to the map daily to see their progress move.

---

### 2. Log Output (Highest Priority Feature)

The primary action. Users log proof of work to earn XP.

**Output types:**
| Type | XP | Notes |
|---|---|---|
| Project | 75 XP | Most common — built something |
| Certification | 200 XP | Highest value single item |
| GitHub repo | 60 XP | Public code artifact |
| Book (chapter) | 50 XP | Per chapter, +150 XP on completion |
| Script | 50 XP | Utility, automation, tool |
| Architecture Design | 75 XP | Diagram, schema, system design |

**Form fields:**
- Output type (chip selector)
- Title (required)
- Skill area (maps to career path node)
- Description (optional, becomes post content)
- Link (optional — GitHub, Notion, portfolio)

**Post-submit:**
- XP gain animation (number floats upward from button)
- XP bar animates to new value
- Streak updates
- Milestone unlock check runs automatically

**Streak bonus XP:**
- 7-day streak active: +25 XP per output
- 14-day streak: +50 XP
- 30-day streak: +100 XP

---

### 3. Milestone Celebration Engine

Triggers automatically when a skill node is completed (all required outputs logged).

**Three tiers of celebration:**

**Small wins** (individual output logged):
- XP float animation
- Subtle chime (optional)
- XP bar fill animation

**Medium wins** (skill node 50% complete):
- Animated achievement badge appears
- Glowing unlock pulse on the node

**Major wins** (skill node 100% complete):
- Full-screen cinematic overlay
- Confetti burst
- Bouncing milestone icon
- Achievement card with rarity badge (Common / Uncommon / Rare / Legendary)
- XP earned display
- AI-generated LinkedIn post preview
- "Share to LinkedIn" CTA

**Reward priority:** Social Recognition > Emotional Reward > Prestige > World Building

The real dopamine is reactions, comments, admiration. The celebration should feel public.

---

### 4. Social Feed

A community feed of milestone posts from users you follow and trending achievers.

**Feed cards show:**
- User avatar, name, level, path, time ago
- Milestone card (achievement + description)
- Skill tags (#DataEngineering, #Python, etc.)
- Evolution % and streak
- Reaction bar: ⚡ (energy), 💬 comment, 🔁 repost

**Following model:**
- Follow/unfollow users
- Feed is chronological, weighted toward people you follow
- No DMs in MVP

**Leaderboard:**
- Weekly XP leaderboard (resets Mondays)
- Shown at top of feed
- Shows top 3 + your current rank

**Structured interaction design (important for introverts):**
Interaction happens *around* achievements, not cold. Examples:
- "Congrats on completing Snowflake!" (contextual, easy to send)
- "How did you approach data modeling?" (knowledge-driven)
This removes social anxiety. People interact about the work, not small talk.

---

### 5. Profile & Proof-of-Work Gallery

The user's public identity that evolves with their skills.

**Profile shows:**
- Avatar, name, current level + title
- Career path + overall evolution %
- Streak
- Total XP, milestones earned, followers
- Progress bars per skill
- Proof-of-work gallery: projects, books, certs, scripts (counts + links)

**Public URL:** `skillforge.app/@username` — shareable outside the app.

---

### 6. AI-Generated Milestone Posts

Triggered after a major milestone unlock. User can edit before sharing.

**Generated via:** OpenAI Edge Function (server-side, key never exposed to client)

**Generated post format:**
```
🚀 Milestone Unlocked: [Skill Name] Complete

Today I completed my [Skill] path and strengthened my understanding of:
• [Key topic 1]
• [Key topic 2]
• [Key topic 3]

Current Career Evolution: [Path] — [X]% Complete
Consistency streak: [N] days 🔥

#[Tag1] #[Tag2] #CareerGrowth
```

**UX:** Post appears in celebration overlay. User can copy to clipboard or tap "Share to LinkedIn" (opens LinkedIn share sheet with pre-filled text).

---

## Reward System

### XP → Level → Title

| Level | XP Required | Title |
|---|---|---|
| 1 | 0 | Learner |
| 2 | 200 | Builder |
| 3 | 500 | Maker |
| 4 | 900 | Practitioner |
| 5 | 1,400 | Specialist |
| 6 | 2,000 | Engineer |
| 7 | 2,700 | Senior Engineer |
| 8 | 3,500 | Tech Lead |
| 9 | 4,400 | Architect |
| 10 | 5,400 | Principal Architect |

### Milestone Rarity
| Rarity | Trigger |
|---|---|
| Common | Streak achievements, first output |
| Uncommon | Skill node 50% complete |
| Rare | Skill node 100% complete |
| Legendary | Full career path complete |

---

## Onboarding Flow

1. **Welcome screen** — tagline, value prop, "Get Started"
2. **Choose your path** — Data Architect / AI Engineer / (more later)
3. **Profile setup** — name, username, optional avatar
4. **Magic link auth** — email only for MVP (no password)
5. **First output prompt** — "What are you working on?" → pre-filled log form
6. **Map reveal** — animated reveal of their evolution map, first node highlighted

Target: User logs their first output before leaving onboarding.

---

## Non-Goals (Future Layers — Do Not Build Now)

- AI tutoring or course content
- Course marketplace
- DMs / private messaging
- Recruiter marketplace
- Live chat / video
- Native push notifications
- Paid tiers / subscriptions
- Mobile app store release (web/Expo Go first)

---

## Success Metrics (MVP)

| Metric | Target |
|---|---|
| D1 retention | > 40% |
| Outputs logged per active user/week | > 3 |
| Milestone celebrations triggered | > 1 per user in first 7 days |
| Feed engagement (reacts/posts seen) | > 15% |
| LinkedIn shares from milestone screen | > 20% of milestones unlocked |
