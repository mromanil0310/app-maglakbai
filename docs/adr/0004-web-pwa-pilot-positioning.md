# ADR-0004 — Ship as a web/PWA pilot (defer native)

**Status:** Accepted (sprint 28 release-readiness audit)

## Context
SkillForge is built with React Native + Expo and was originally framed for an iOS App Store launch. In reality there is no native build, the app uses web-only APIs (e.g. `localStorage`, injected CSS keyframes), and it deploys as a Vite-built static site. The BAEF release-readiness audit surfaced that the native framing was aspirational, not shipped (REL-001).

## Decision
Position and ship SkillForge as a **web/PWA pilot**. Align release decision, P0 list, docs, and user guide to the web/PWA reality. Keep the RN/Expo codebase so a native build remains possible later, but do not claim native until one is actually built and tested.

## Consequences
- Honest scope: the Conditional-Go release decision and backlog reflect what's actually shippable.
- Carrying both Vite (web) and Expo/Metro (native) tooling is overhead for a web-only target (tracked as **ARCH-007**); revisit if/when native is committed.
- PWA install + offline use is the distribution path; deploy via Vercel (see `docs/DEPLOYMENT.md`).
