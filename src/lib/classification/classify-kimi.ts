// =============================================================================
// Kimi (Moonshot AI) classification provider.
//
// Moonshot exposes an OpenAI-compatible API, so we call it with plain fetch (no
// extra dependency) and reuse the EXISTING taxonomy prompt + Zod schema, so the
// output is identical to the Anthropic path — only cheaper.
//
// Env:
//   KIMI_API_KEY (or MOONSHOT_API_KEY)  — required
//   KIMI_BASE_URL   default https://api.moonshot.ai/v1
//   KIMI_MODEL      default kimi-k2-0905-preview  (set to your exact Kimi model id)
// =============================================================================
import { ClassificationOutputSchema, type ClassificationOutput } from './schemas';
import { buildClassificationPrompt, buildAdContext } from './prompt';

const BASE_URL = () => process.env.KIMI_BASE_URL || 'https://api.moonshot.ai/v1';
const MODEL = () => process.env.KIMI_MODEL || 'kimi-k2-0905-preview';
const KEY = () => process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY || '';

export function kimiConfigured(): boolean {
  return Boolean(KEY());
}

// Moonshot json_object mode requires the word "json" and explicit keys.
const JSON_INSTRUCTION = `

Respond with ONLY a single JSON object, no prose, with these exact keys:
"assetType","visualFormat","hookTactic","messagingAngle","awarenessStage","creativeMechanic","offerType","intendedAudience" (each a short kebab-case value from the taxonomy above), "hookScore" (integer 1-10), "conceptCluster" (2-3 word lowercase hyphenated label), "confidence" (number 0-1).`;

export interface KimiAdInput {
  brandName?: string; category?: string; body?: string; title?: string; ctaText?: string; displayFormat?: string;
}

export async function classifyAdWithKimi(ad: KimiAdInput, signal?: AbortSignal): Promise<ClassificationOutput> {
  const res = await fetch(`${BASE_URL()}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY()}` },
    signal,
    body: JSON.stringify({
      model: MODEL(),
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildClassificationPrompt() + JSON_INSTRUCTION },
        { role: 'user', content: buildAdContext(ad) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Kimi ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Kimi returned no content');
  const parsed = ClassificationOutputSchema.safeParse(JSON.parse(content));
  if (!parsed.success) throw new Error(`Kimi output failed schema: ${parsed.error.issues[0]?.message}`);
  return parsed.data;
}

export interface KimiResult { adId: string; ok: boolean; output?: ClassificationOutput; error?: string }

// Classify many ads with a bounded concurrency pool.
export async function classifyManyWithKimi(
  ads: Array<{ id: string } & KimiAdInput>,
  concurrency = 6
): Promise<KimiResult[]> {
  const results: KimiResult[] = new Array(ads.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= ads.length) return;
      const ad = ads[i];
      try {
        const output = await classifyAdWithKimi(ad);
        results[i] = { adId: ad.id, ok: true, output };
      } catch (e) {
        results[i] = { adId: ad.id, ok: false, error: e instanceof Error ? e.message : 'error' };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, ads.length) }, worker));
  return results;
}
