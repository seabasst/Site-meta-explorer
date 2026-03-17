# Phase 41: Hikaru AI Enhancement - Research

**Researched:** 2026-03-17
**Domain:** AI chat with embedded interactive charts (Recharts + SSE streaming)
**Confidence:** HIGH

## Summary

Hikaru AI currently streams text responses (with markdown tables, headers, and bold formatting) via SSE from a server-side Anthropic agentic tool loop. The enhancement requires the AI to emit structured chart data alongside text, and the client to detect and render interactive Recharts charts inline within the chat message flow.

The project already uses Recharts 3.6.0 extensively across the dashboard (BarChart, PieChart, AreaChart with ResponsiveContainer). The key architectural challenge is bridging the AI response (which is text) with React chart components. The recommended approach is a **structured block protocol**: the AI outputs special delimited JSON blocks (e.g., `:::chart {...} :::`) within its text response, and the client-side `MessageContent` parser detects these blocks and renders the appropriate chart component.

**Primary recommendation:** Extend the SSE streaming protocol with a new `chart` event type, OR embed chart specs as fenced code blocks in the AI's text response that the existing `MessageContent` renderer can parse and render as Recharts components.

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | ^3.6.0 | Chart rendering | Already used across all dashboard charts |
| @anthropic-ai/sdk | (installed) | AI backend | Already powers Hikaru |
| React 19 | latest | UI framework | Project standard |

### Supporting (no new dependencies needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | (installed) | Icons for chart headers | Chart type indicators |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts | Nivo, Victory | Would add dependency; Recharts already in use everywhere |
| Custom chart spec | Vega-Lite spec | Overkill; we only need 4-5 chart types |
| Vercel AI SDK | Custom SSE | Already have working custom SSE; migration would be scope creep |

**Installation:**
```bash
# No new packages needed - everything is already installed
```

## Architecture Patterns

### Current Architecture (as-is)

```
Client (hikaru/page.tsx)          Server (api/chat/hikaru/route.ts)
  |                                  |
  |-- POST /api/chat/hikaru -------->|
  |                                  |-- Anthropic API (with 9 tools)
  |<-- SSE: thinking events ---------|
  |<-- SSE: tool_result events ------|
  |<-- SSE: text chunks -------------|  (20 chars each)
  |<-- SSE: done --------------------|
  |                                  |
  MessageContent parses markdown:
    - Tables (| ... |)
    - Headers (# ## ###)
    - Bold (**text**)
    - Bullets (- / *)
```

### Recommended Architecture (to-be)

```
Client (hikaru/page.tsx)          Server (api/chat/hikaru/route.ts)
  |                                  |
  |-- POST /api/chat/hikaru -------->|
  |                                  |-- Anthropic API (with 9 tools + chart instructions)
  |<-- SSE: thinking events ---------|
  |<-- SSE: tool_result events ------|
  |<-- SSE: text chunks -------------|  (includes :::chart blocks)
  |<-- SSE: done --------------------|
  |                                  |
  MessageContent parses:
    - All existing markdown formats
    - NEW: :::chart{json}::: blocks -> HikaruChart component
```

### Pattern 1: Chart Specification Block in AI Output
**What:** The AI includes structured chart specs within its text response using a delimiter format
**When to use:** Every time the AI wants to show a chart alongside analysis

The AI is instructed (via system prompt) to emit chart blocks like:

```
Here's the format distribution across airlines:

:::chart
{"type":"pie","title":"Format Distribution","data":[{"name":"Video","value":45},{"name":"Image","value":35},{"name":"Carousel","value":20}]}
:::

As you can see, video dominates the airline category...
```

The `MessageContent` parser splits on `:::chart` and `:::` delimiters, parses JSON, and renders a `<HikaruChart>` component.

### Pattern 2: Chart Type Registry
**What:** A mapping from chart spec types to Recharts components
**When to use:** To keep the chart rendering modular and extensible

```typescript
// hikaru-charts.tsx
type ChartSpec = {
  type: 'bar' | 'pie' | 'area' | 'horizontal-bar';
  title: string;
  data: Record<string, unknown>[];
  xKey?: string;
  yKey?: string;
  keys?: string[];     // for multi-series
  colors?: string[];
};

function HikaruChart({ spec, darkMode }: { spec: ChartSpec; darkMode: boolean }) {
  switch (spec.type) {
    case 'bar': return <HikaruBarChart {...} />;
    case 'pie': return <HikaruPieChart {...} />;
    case 'area': return <HikaruAreaChart {...} />;
    case 'horizontal-bar': return <HikaruHorizontalBarChart {...} />;
  }
}
```

### Pattern 3: System Prompt Enhancement
**What:** Add chart output instructions to HIKARU_SYSTEM_PROMPT
**When to use:** This is the core mechanism - the AI decides WHEN to emit charts

The system prompt gets a new section telling Hikaru when and how to emit chart blocks. The AI chooses to emit charts when:
- Comparing numeric values across brands/categories (bar chart)
- Showing proportional breakdowns (pie chart)
- Showing time series / trends (area chart)
- Showing ranked lists (horizontal bar chart)

### Recommended Project Structure
```
src/
├── app/dashboard/v2/hikaru/
│   ├── page.tsx                    # Main page (modify MessageContent)
│   └── hikaru-charts.tsx           # NEW: chart components for chat
├── components/ui/
│   └── chart.tsx                   # Existing: ChartContainer, etc.
└── app/api/chat/hikaru/
    └── route.ts                    # Modify system prompt
```

### Anti-Patterns to Avoid
- **Separate SSE event type for charts:** Don't create a `{ type: 'chart', data: ... }` SSE event. The chart data should flow as part of the text stream so it appears inline at the right position in the message. If you use a separate event, you lose the ordering context (chart appears after all text, not inline).
- **Letting the AI output raw Recharts JSX:** The AI should output a JSON spec, not React code. Keeps it deterministic and parseable.
- **Making charts depend on V2Card or DashboardCard:** Chat charts should be self-contained with their own lightweight wrapper, not tied to dashboard layout components.
- **Over-engineering the chart spec:** Start with 4 chart types and a flat JSON schema. Don't build a mini Vega-Lite.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart rendering | Custom SVG/Canvas | Recharts (already installed) | Handles responsiveness, tooltips, animations |
| Chart dark mode styling | Per-chart dark mode logic | Shared darkMode-aware color config | Dashboard already solves this |
| Markdown parsing in chat | Full markdown parser | Existing line-by-line parser in MessageContent | Already works, just needs chart block detection |
| Number formatting | Custom formatters | Existing formatNumber / formatReach patterns from dashboard | Already solved in codebase |

**Key insight:** The existing `MessageContent` component in `hikaru/page.tsx` already parses markdown-like blocks (tables, headers, bullets). Adding chart block detection is a natural extension of this same pattern, not a new system.

## Common Pitfalls

### Pitfall 1: Chart Data in Streaming Chunks
**What goes wrong:** Chart JSON spec arrives in multiple 20-character SSE chunks. If you try to parse mid-stream, you get incomplete JSON.
**Why it happens:** The server streams text in 20-char chunks (line 886 of route.ts).
**How to avoid:** Only parse `:::chart` blocks in the *completed* message content, not during streaming. During streaming, show the raw text (or a placeholder). Once the message is finalized, parse and render charts.
**Warning signs:** JSON parse errors appearing in console during streaming.

### Pitfall 2: AI Generating Invalid Chart JSON
**What goes wrong:** The AI outputs malformed JSON in the chart block, breaking the entire message render.
**Why it happens:** LLMs occasionally produce invalid JSON, especially for complex data structures.
**How to avoid:** Wrap chart JSON parsing in try/catch. On failure, render the raw chart block as a code block (graceful degradation). Also keep chart specs simple (flat arrays, not nested objects).
**Warning signs:** Chart blocks rendering as raw text.

### Pitfall 3: ResponsiveContainer Sizing in Chat
**What goes wrong:** Charts render at 0 height or overflow the chat message area.
**Why it happens:** ResponsiveContainer needs a parent with explicit height. Chat messages are variable-height.
**How to avoid:** Give chart containers a fixed height (e.g., 250px) and full width. Don't rely on ResponsiveContainer auto-sizing within a flex chat layout.
**Warning signs:** Charts invisible or overflowing.

### Pitfall 4: System Prompt Bloat
**What goes wrong:** Adding detailed chart instructions makes the system prompt too long, eating into context window for tool results.
**Why it happens:** Chart format spec + examples can be verbose.
**How to avoid:** Keep chart instructions concise. Use a simple JSON schema with 2-3 examples. The AI is smart enough to generalize.
**Warning signs:** Truncated tool results, lower quality answers.

### Pitfall 5: Too Many Charts Per Response
**What goes wrong:** AI produces 5+ charts in one response, making it slow and overwhelming.
**Why it happens:** The system prompt says "use charts when answering data questions" and the AI over-applies.
**How to avoid:** Instruct the AI to use 1-2 charts max per response, and to prefer the most impactful visualization.
**Warning signs:** Responses with more charts than text.

## Code Examples

### Chart Spec JSON Schema (what the AI outputs)
```typescript
// The AI outputs these as :::chart{...}::: blocks in its text
interface ChartSpec {
  type: 'bar' | 'pie' | 'area' | 'horizontal-bar';
  title: string;
  data: { name: string; value: number; [key: string]: unknown }[];
  // Optional for multi-series bar/area:
  keys?: string[];        // e.g., ['reach', 'adCount']
  colors?: string[];      // e.g., ['#1235e2', '#10b981']
  // Optional formatting:
  xKey?: string;          // default: 'name'
  valueFormatter?: 'number' | 'reach' | 'percent';
}
```

### Parsing Chart Blocks in MessageContent
```typescript
// Inside MessageContent, before the line-by-line parse:
function parseContentBlocks(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const chartRegex = /:::chart\n([\s\S]*?)\n:::/g;
  let lastIndex = 0;
  let match;

  while ((match = chartRegex.exec(content)) !== null) {
    // Text before chart
    if (match.index > lastIndex) {
      blocks.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }
    // Chart block
    try {
      const spec = JSON.parse(match[1]);
      blocks.push({ type: 'chart', spec });
    } catch {
      // Graceful degradation: show as code block
      blocks.push({ type: 'text', content: match[0] });
    }
    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < content.length) {
    blocks.push({ type: 'text', content: content.slice(lastIndex) });
  }

  return blocks;
}
```

### HikaruBarChart (reusing dashboard patterns)
```typescript
// Source: adapted from existing dashboard chart patterns
function HikaruBarChart({ spec, darkMode }: { spec: ChartSpec; darkMode: boolean }) {
  const COLORS = spec.colors || ['#1235e2', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className={`rounded-xl border p-4 my-3 ${
      darkMode ? 'bg-[#1235e2]/5 border-[#1235e2]/10' : 'bg-white border-slate-200'
    }`}>
      <h4 className="text-sm font-semibold mb-3">{spec.title}</h4>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={spec.data}>
          <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1e293b' : '#e2e8f0'} />
          <XAxis dataKey={spec.xKey || 'name'} tick={{ fontSize: 11, fill: darkMode ? '#94a3b8' : '#64748b' }} />
          <YAxis tick={{ fontSize: 11, fill: darkMode ? '#94a3b8' : '#64748b' }} />
          <Tooltip contentStyle={{
            backgroundColor: darkMode ? '#1e293b' : '#fff',
            border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
            borderRadius: 8,
          }} />
          {(spec.keys || ['value']).map((key, i) => (
            <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### System Prompt Addition
```typescript
const CHART_INSTRUCTIONS = `
When your answer involves comparing numbers or showing distributions, include a chart using this format:

:::chart
{"type":"bar","title":"Chart Title","data":[{"name":"Label","value":123}]}
:::

Chart types available:
- "bar": For comparing values across categories (brands, formats, etc.)
- "pie": For showing proportional breakdowns (format mix, share of voice)
- "area": For showing trends over time (weekly/monthly data)
- "horizontal-bar": For ranked lists (top brands by reach)

Rules:
- Use 1-2 charts max per response. Pick the most impactful visualization.
- Always include text analysis alongside charts, never a chart alone.
- Keep data arrays under 12 items. Aggregate smaller items into "Other" if needed.
- Use the "name" field for labels and "value" for the primary metric.
- For multi-series, use "keys" array: {"type":"bar","keys":["reach","adCount"],"data":[{"name":"Brand","reach":100,"adCount":5}]}
`;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Text-only AI responses with markdown tables | Structured chart blocks in AI text | This phase | Visual, interactive data answers |
| Dashboard charts tightly coupled to V2Card | Lightweight chart wrappers for chat context | This phase | Reusable chart patterns |
| Full text streamed then parsed | Parse completed messages, stream shows raw | This phase | Avoids JSON parse errors mid-stream |

**Relevant codebase patterns:**
- All dashboard charts use `ResponsiveContainer` with explicit height
- Color palette: `#1235e2` (primary blue), `#10b981` (green), `#f59e0b` (amber), `#ef4444` (red), `#8b5cf6` (purple)
- Dark mode: conditional `darkMode ? ... : ...` pattern via `useV2()` context
- Tooltip styling: consistent across all charts (rounded-lg border, theme-aware bg)

## Open Questions

1. **Chart interactivity scope**
   - What we know: Recharts provides hover tooltips, click events, and animations out of the box
   - What's unclear: Should clicking a chart element (e.g., a bar for "Ryanair") trigger a follow-up question to Hikaru?
   - Recommendation: Start with hover tooltips only (matches dashboard). Click-to-drill-down can be Phase 42.

2. **Chart rendering during streaming vs after**
   - What we know: Chart JSON arrives in chunks during streaming; parsing mid-stream will fail
   - What's unclear: Should we show a placeholder skeleton during streaming, or just show raw text?
   - Recommendation: During streaming, detect `:::chart` opening tag and show a small "Generating chart..." placeholder. Render actual chart only after message is complete.

3. **Chart data freshness**
   - What we know: The AI calls tools that query the database, then writes analysis text with embedded charts. The chart data comes from the AI's interpretation of tool results.
   - What's unclear: Should the chart data be the raw tool output (guaranteed accurate) or the AI's summary (potentially rounded/approximated)?
   - Recommendation: Let the AI construct chart data from tool results. It's simpler and the AI is instructed to be data-driven. Add a small disclaimer "Data from AI analysis" below charts.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/app/api/chat/hikaru/route.ts` - full Hikaru backend (933 lines, 9 tools, SSE streaming)
- Codebase analysis: `src/app/dashboard/v2/hikaru/page.tsx` - full Hikaru frontend (444 lines, MessageContent parser)
- Codebase analysis: `src/components/dashboard/*.tsx` - 6 chart components using Recharts
- Codebase analysis: `src/components/ui/chart.tsx` - ChartContainer, ChartTooltip, ChartTooltipContent
- `package.json` confirms recharts ^3.6.0

### Secondary (MEDIUM confidence)
- Recharts documentation patterns observed from existing codebase usage (ResponsiveContainer, dark mode styling)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - already installed and used extensively
- Architecture: HIGH - natural extension of existing MessageContent parser pattern
- Pitfalls: HIGH - identified from direct codebase analysis (streaming chunks, container sizing)
- Chart types: MEDIUM - recommended based on tool output data shapes, but may need adjustment based on real AI outputs

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable - no external dependencies changing)
