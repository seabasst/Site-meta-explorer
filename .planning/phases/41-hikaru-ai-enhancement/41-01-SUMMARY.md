---
phase: 41-hikaru-ai-enhancement
plan: 01
subsystem: hikaru-ai
tags: [recharts, hikaru, charts, ai-visualization]
dependency-graph:
  requires: []
  provides: [hikaru-chart-component, chart-spec-type, chart-system-prompt]
  affects: [41-02, 41-03]
tech-stack:
  added: []
  patterns: [chart-spec-json-schema, fenced-block-chart-protocol]
key-files:
  created:
    - src/app/dashboard/v2/hikaru/hikaru-charts.tsx
  modified:
    - src/app/api/chat/hikaru/route.ts
decisions:
  - id: HIKARU-01
    decision: "Charts self-contained with darkMode prop, no V2Card/useV2 dependency"
    reason: "Charts render inside chat messages, outside V2 context provider"
  - id: HIKARU-02
    decision: ":::chart fenced block protocol for AI chart emission"
    reason: "Simple delimiter parsing, valid JSON between markers"
metrics:
  duration: "~2 minutes"
  completed: 2026-03-17
---

# Phase 41 Plan 01: Chart Component Library Summary

Recharts-based HikaruChart component with 4 chart types and AI system prompt chart emission instructions.

## What Was Done

### Task 1: Create HikaruChart component library
- Created `hikaru-charts.tsx` with `ChartSpec` type and `HikaruChart` dispatcher component
- Four internal chart components: vertical bar, donut pie, area, horizontal bar
- Dark mode styling matching dashboard conventions (same palette, tooltip style, axis ticks)
- `formatValue` helper supporting number/reach/percent formatting
- Self-contained: no V2Card or useV2 imports
- **Commit:** `9aff345`

### Task 2: Add chart instructions to Hikaru system prompt
- Appended ~15 lines of chart emission instructions to `HIKARU_SYSTEM_PROMPT`
- Documents all 4 chart types with use-case guidance
- Rules: max 2 charts per response, under 12 data items, always accompanied by text
- Multi-series and valueFormatter support documented
- No other changes to route.ts (tools, streaming, handler unchanged)
- **Commit:** `1ddb576`

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| HIKARU-01 | Charts self-contained with darkMode prop | Renders inside chat messages, outside V2 context provider |
| HIKARU-02 | :::chart fenced block protocol | Simple delimiter parsing, valid JSON between markers |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Tooltip formatter type signature**
- **Found during:** Task 1 verification
- **Issue:** Recharts Tooltip formatter expects `(value: number | undefined)` but code used `(value: number)`
- **Fix:** Changed to `(value: number | undefined)` with `?? 0` fallback
- **Files modified:** hikaru-charts.tsx
- **Commit:** Included in `9aff345`

## Verification Results

- TypeScript compilation: passes with no errors
- Exports verified: `ChartSpec` type and `HikaruChart` function both exported
- System prompt contains `:::chart` format instructions
- No new dependencies (recharts v3.6.0 already installed)

## Next Phase Readiness

Plan 02 can now:
- Import `HikaruChart` and `ChartSpec` from `hikaru-charts.tsx`
- Parse `:::chart` blocks from AI responses in the chat message renderer
- Wire chart rendering into the Hikaru chat message flow
