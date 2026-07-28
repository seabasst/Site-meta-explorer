import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdminEmail } from '@/lib/admin';
import { getMetaToken, metaGet } from '@/lib/meta-token';

// =============================================================================
// GET /api/connect/meta/decode?accountId=act_XXXX
//
// Decodes a connected ad account: real performance (Insights) + a creative
// genome (classify their own ads) + the gap vs what wins in the ad library.
// Auth-gated. Performance works with the system token today; creative
// classification needs ANTHROPIC_API_KEY (production) and degrades gracefully.
// =============================================================================

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DUR = `EXTRACT(EPOCH FROM (COALESCE(a."endDate", NOW()) - a."startDate")) / 86400`;
const roasOf = (arr?: { value: string }[]) => (arr && arr[0] ? Number(arr[0].value) : null);
const num = (v?: string) => (v == null ? null : Number(v));

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to decode an account' }, { status: 401 });
  if (!isAdminEmail(session.user.email)) return NextResponse.json({ error: 'Your account is not authorized for this feature' }, { status: 403 });

  const accountId = request.nextUrl.searchParams.get('accountId')?.trim();
  if (!accountId || !/^act_\d+$/.test(accountId)) return NextResponse.json({ error: 'Valid accountId (act_…) required' }, { status: 400 });

  const token = getMetaToken();
  if (!token) return NextResponse.json({ error: 'No Facebook token configured' }, { status: 503 });

  try {
    // --- account meta + performance (real) ---
    const acct = await metaGet<{ name: string; currency: string }>(`${accountId}?fields=name,currency`, token);
    const insWrap = await metaGet<{ data: Array<Record<string, string | { value: string }[]>> }>(
      `${accountId}/insights?fields=spend,impressions,reach,clicks,ctr,cpc,frequency,purchase_roas,actions&date_preset=last_30d&level=account`,
      token
    );
    const ins = insWrap.data?.[0] ?? {};
    const purchases = ((ins.actions as { action_type: string; value: string }[] | undefined) ?? [])
      .find((x) => x.action_type === 'purchase' || x.action_type === 'omni_purchase');

    const topWrap = await metaGet<{ data: Array<Record<string, string | { value: string }[]>> }>(
      `${accountId}/insights?fields=ad_name,spend,purchase_roas,ctr,reach&level=ad&date_preset=last_30d&sort=spend_descending&limit=5`,
      token
    );
    const topAds = (topWrap.data ?? []).map((a) => ({
      name: (a.ad_name as string) ?? '—',
      spend: num(a.spend as string),
      roas: roasOf(a.purchase_roas as { value: string }[]),
      ctr: num(a.ctr as string),
      reach: num(a.reach as string),
    }));

    const performance = {
      windowDays: 30,
      currency: acct.currency,
      spend: num(ins.spend as string),
      impressions: num(ins.impressions as string),
      reach: num(ins.reach as string),
      clicks: num(ins.clicks as string),
      ctr: num(ins.ctr as string),
      cpc: num(ins.cpc as string),
      frequency: num(ins.frequency as string),
      roas: roasOf(ins.purchase_roas as { value: string }[]),
      purchases: purchases ? Number(purchases.value) : null,
      topAds,
    };

    // Industries the ad-library has brief-depth for — used to constrain the
    // per-account industry inference so the decode's brief lands on real data.
    const indRows = await prisma.$queryRawUnsafe<Array<{ category: string }>>(
      `SELECT b.category FROM "AdClassification" c JOIN "AdLibraryAd" a ON a.id = c."adId" JOIN "AdLibraryBrand" b ON b.id = a."brandId"
       WHERE b.category IS NOT NULL AND a."startDate" IS NOT NULL
       GROUP BY b.category HAVING COUNT(*) >= 40 ORDER BY COUNT(*) DESC`
    );
    const availableIndustries = indRows.map((r) => r.category);

    // --- creative genome + industry inference: classify a sample (best-effort) ---
    let creativeGenome: null | { classifiedAds: number; top: Record<string, string>; mix: Record<string, { gene: string; count: number }[]> } = null;
    let creativeNote: string | null = null;
    let suggestedIndustry: string | null = null; // null → "All industries"
    try {
      const adsWrap = await metaGet<{ data: Array<{ name: string; creative?: { title?: string; body?: string } }> }>(
        `${accountId}/ads?fields=name,creative{title,body}&effective_status=["ACTIVE"]&limit=15`,
        token
      );
      const samples = (adsWrap.data ?? [])
        .map((a) => ({ title: a.creative?.title ?? a.name ?? '', body: a.creative?.body ?? '' }))
        .filter((a) => a.title || a.body)
        .slice(0, 12);

      if (samples.length === 0) creativeNote = 'No active ads with creative text to classify.';
      else if (!process.env.ANTHROPIC_API_KEY) creativeNote = 'Creative genome runs on deploy (needs the AI key).';
      else {
        const options = [...availableIndustries.map((i) => `"${i}"`), '"All industries"'].join(', ');
        const claude = new Anthropic();
        const r = await claude.messages.create({
          model: 'claude-sonnet-4-20250514', max_tokens: 1400,
          system: `You classify Meta ads and identify the advertiser's industry. Return ONLY JSON: {"industry": one of [${options}] (pick the single closest fit, else "All industries"), "ads": [one object per ad with keys hookTactic, messagingAngle, creativeMechanic, visualFormat using short kebab-case values like social-proof, bold-claim, price-value, testimonial, lifestyle, before-after]}.`,
          messages: [{ role: 'user', content: `Advertiser: ${acct.name}. Classify these ${samples.length} ads and pick the best-fit industry:\n${samples.map((s, i) => `${i + 1}. ${s.title} — ${s.body}`.slice(0, 300)).join('\n')}` }],
        });
        const text = r.content.map((c) => ('text' in c ? c.text : '')).join('');
        const m = text.match(/\{[\s\S]*\}/);
        const parsed: { industry?: string; ads?: Record<string, string>[] } = m ? JSON.parse(m[0]) : {};
        const classified = Array.isArray(parsed.ads) ? parsed.ads : [];
        if (parsed.industry && parsed.industry !== 'All industries' && availableIndustries.includes(parsed.industry)) {
          suggestedIndustry = parsed.industry;
        }
        const dims = ['hookTactic', 'messagingAngle', 'creativeMechanic', 'visualFormat'];
        const mix: Record<string, { gene: string; count: number }[]> = {};
        const top: Record<string, string> = {};
        for (const d of dims) {
          const counts: Record<string, number> = {};
          for (const c of classified) if (c[d]) counts[c[d]] = (counts[c[d]] ?? 0) + 1;
          const sorted = Object.entries(counts).map(([gene, count]) => ({ gene, count })).sort((a, b) => b.count - a.count);
          mix[d] = sorted; if (sorted[0]) top[d] = sorted[0].gene;
        }
        creativeGenome = { classifiedAds: classified.length, top, mix };
      }
    } catch (e) {
      creativeNote = `Creative classification skipped: ${e instanceof Error ? e.message : 'error'}`;
    }

    // --- industry benchmark: best-performing gene per dimension (ad library) ---
    const benchRows = await prisma.$queryRawUnsafe<Array<{ dim: string; gene: string; med: number }>>(
      ['hookTactic', 'messagingAngle', 'creativeMechanic', 'visualFormat'].map((d) => `
        (SELECT '${d}' AS dim, c."${d}" AS gene,
          ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY ${DUR}))::numeric)::int AS med
         FROM "AdClassification" c JOIN "AdLibraryAd" a ON a.id = c."adId"
         WHERE a."startDate" IS NOT NULL GROUP BY c."${d}" HAVING COUNT(*) >= 10 ORDER BY med DESC LIMIT 1)`).join(' UNION ALL ')
    );
    const benchmark: Record<string, { best: string; medianDays: number }> = {};
    for (const b of benchRows) benchmark[b.dim] = { best: b.gene, medianDays: b.med };

    // --- verdict (rule-based) ---
    const verdict: { tone: 'good' | 'warn' | 'note'; text: string }[] = [];
    if (performance.roas != null) {
      if (performance.roas >= 2) verdict.push({ tone: 'good', text: `Strong ROAS of ${performance.roas.toFixed(2)}× over 30 days — the account is profitable.` });
      else if (performance.roas < 1) verdict.push({ tone: 'warn', text: `ROAS is ${performance.roas.toFixed(2)}× — below breakeven. Every ${performance.currency} spent returns less than one back.` });
      else verdict.push({ tone: 'note', text: `ROAS is ${performance.roas.toFixed(2)}× — thin margin; creative or targeting has room.` });
    }
    if (performance.ctr != null && performance.ctr < 1) verdict.push({ tone: 'warn', text: `CTR is ${performance.ctr.toFixed(2)}% — below the ~1% healthy line. The hook isn't landing.` });
    if (performance.frequency != null && performance.frequency >= 3) verdict.push({ tone: 'warn', text: `Frequency ${performance.frequency.toFixed(1)} — audiences are seeing the same ads a lot; fatigue risk.` });
    if (creativeGenome && benchmark.hookTactic && creativeGenome.top.hookTactic && creativeGenome.top.hookTactic !== benchmark.hookTactic.best)
      verdict.push({ tone: 'note', text: `Your top hook is "${creativeGenome.top.hookTactic}", but the best-performing hook in the library is "${benchmark.hookTactic.best}" (${benchmark.hookTactic.medianDays}d median run). Worth testing.` });

    return NextResponse.json({
      account: { id: accountId, name: acct.name },
      suggestedIndustry,
      performance,
      creativeGenome,
      creativeNote,
      benchmark,
      verdict,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Decode failed' }, { status: 502 });
  }
}
