# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
General visitors who want to try short (1-3 minute) activities without any coding or study context, and hackathon demo judges evaluating the product live.

## Product Purpose
SKILL//MIX lets a person do short activities (mental math, pattern finding, word weaving, shape composing), records what they actually produced, and has an AI describe observable features of that output. Success: a first-time visitor starts an activity within seconds and understands what the AI feedback is grounded in.

## Positioning
The feedback describes the submitted output and the app-measured numbers only. It never scores, grades, ranks, or claims the person's ability improved.

## Operating Context
Hackathon MVP, two developers, 5-6 hours. Activities are small, self-contained and run in the browser; results are kept in the visitor's own browser.

## Capabilities and Constraints
- No login, database, ranking or levels. LocalStorage only.
- AI analysis is opt-in (consent banner on DISCOVER); output is sent to an external AI service (OpenRouter) only with that consent.
- Four MVP activities: QUICK THINK, PATTERN FIND, WORD WEAVE, SHAPE MIX; more are added by registering in the activity registry.
- Spec of record: `PRD.md` (visual rules in section 10 are binding).

## Brand Commitments
Name: SKILL//MIX. Binding visual rules from PRD section 10 (palette, type families, 2px black borders, 12-col asymmetric grid, Lucide-only icons).

## Evidence on Hand
No real user data, testimonials or metrics exist. Do not fabricate any.

## Product Principles
- Observe, don't judge: wording describes what happened, never rates the person.
- The person's own output is the centre of every screen.
- AI is optional and clearly labelled as external; the app works without it.
- Small and honest scope: nothing the PRD does not list.

## Accessibility & Inclusion
Body contrast at least 4.5:1, visible focus rings, 44px minimum touch targets, `prefers-reduced-motion` respected. Korean is the primary UI language.
