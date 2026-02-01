'use client';

import { useMemo } from 'react';
import type { FacebookAdResult } from '@/lib/facebook-api';

interface AdCopyAnalysisProps {
  ads: FacebookAdResult[];
}

// Common CTA patterns to look for
const CTA_PATTERNS = [
  { pattern: /shop\s*now/i, label: 'Shop Now' },
  { pattern: /buy\s*now/i, label: 'Buy Now' },
  { pattern: /learn\s*more/i, label: 'Learn More' },
  { pattern: /get\s*(yours|started|it)/i, label: 'Get Started' },
  { pattern: /order\s*(now|today)/i, label: 'Order Now' },
  { pattern: /sign\s*up/i, label: 'Sign Up' },
  { pattern: /free\s*(shipping|trial|delivery)/i, label: 'Free Offer' },
  { pattern: /limited\s*(time|offer|edition)/i, label: 'Urgency' },
  { pattern: /save\s*\d+%?/i, label: 'Discount' },
  { pattern: /\d+%\s*off/i, label: 'Discount' },
  { pattern: /don't\s*miss/i, label: 'FOMO' },
  { pattern: /last\s*chance/i, label: 'Urgency' },
  { pattern: /try\s*(it|now)/i, label: 'Try It' },
  { pattern: /discover/i, label: 'Discover' },
  { pattern: /transform/i, label: 'Transform' },
  { pattern: /upgrade/i, label: 'Upgrade' },
];

// Stop words to filter out
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
  'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'we', 'they', 'he', 'she',
  'my', 'your', 'our', 'their', 'his', 'her', 'all', 'each', 'every', 'both', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'when', 'where',
  'why', 'how', 'what', 'which', 'who', 'whom', 'if', 'then', 'else', 'about', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off',
  'over', 'under', 'again', 'further', 'once', 'any', 'can', 'get', 'got', 'new',
]);

function extractWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

function extractPhrases(text: string): string[] {
  // Extract 2-3 word phrases
  const words = text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/);
  const phrases: string[] = [];

  for (let i = 0; i < words.length - 1; i++) {
    if (words[i].length > 2 && words[i + 1].length > 2) {
      const twoWord = `${words[i]} ${words[i + 1]}`;
      if (!STOP_WORDS.has(words[i]) || !STOP_WORDS.has(words[i + 1])) {
        phrases.push(twoWord);
      }
    }
  }

  return phrases;
}

export function AdCopyAnalysis({ ads }: AdCopyAnalysisProps) {
  const analysis = useMemo(() => {
    const allCopy = ads
      .map(ad => ad.creativeBody)
      .filter((body): body is string => !!body);

    const allTitles = ads
      .map(ad => ad.linkTitle)
      .filter((title): title is string => !!title);

    if (allCopy.length === 0 && allTitles.length === 0) {
      return null;
    }

    // Count CTAs
    const ctaCounts = new Map<string, number>();
    for (const copy of [...allCopy, ...allTitles]) {
      for (const { pattern, label } of CTA_PATTERNS) {
        if (pattern.test(copy)) {
          ctaCounts.set(label, (ctaCounts.get(label) || 0) + 1);
        }
      }
    }

    // Count words
    const wordCounts = new Map<string, number>();
    for (const copy of allCopy) {
      for (const word of extractWords(copy)) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }

    // Count phrases
    const phraseCounts = new Map<string, number>();
    for (const copy of allCopy) {
      for (const phrase of extractPhrases(copy)) {
        phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
      }
    }

    // Hook analysis
    const hooks = {
      questions: allCopy.filter(c => c.includes('?')).length,
      emojis: allCopy.filter(c => /[\u{1F300}-\u{1F9FF}]/u.test(c)).length,
      numbers: allCopy.filter(c => /\d+/.test(c)).length,
      allCaps: allCopy.filter(c => /[A-Z]{3,}/.test(c)).length,
      exclamations: allCopy.filter(c => c.includes('!')).length,
    };

    // Sort and get top items
    const topCTAs = Array.from(ctaCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const topWords = Array.from(wordCounts.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    const topPhrases = Array.from(phraseCounts.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Average copy length
    const avgLength = allCopy.length > 0
      ? Math.round(allCopy.reduce((sum, c) => sum + c.length, 0) / allCopy.length)
      : 0;

    return {
      totalAds: allCopy.length,
      topCTAs,
      topWords,
      topPhrases,
      hooks,
      avgLength,
    };
  }, [ads]);

  if (!analysis) {
    return (
      <div className="text-center py-6 text-[var(--text-muted)]">
        No ad copy available for analysis.
      </div>
    );
  }

  const maxWordCount = Math.max(...analysis.topWords.map(([_, c]) => c), 1);

  return (
    <div className="space-y-6">
      {/* Hook Patterns */}
      <div>
        <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Hook Patterns Used</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {[
            { label: 'Questions', value: analysis.hooks.questions, icon: '?' },
            { label: 'Emojis', value: analysis.hooks.emojis, icon: '😀' },
            { label: 'Numbers', value: analysis.hooks.numbers, icon: '#' },
            { label: 'ALL CAPS', value: analysis.hooks.allCaps, icon: 'A' },
            { label: 'Exclamations', value: analysis.hooks.exclamations, icon: '!' },
          ].map(item => (
            <div
              key={item.label}
              className="text-center p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]"
            >
              <div className="text-lg mb-1">{item.icon}</div>
              <div className="text-xl font-bold text-[var(--text-primary)]">{item.value}</div>
              <div className="text-xs text-[var(--text-muted)]">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTAs */}
      {analysis.topCTAs.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Common CTAs & Tactics</h4>
          <div className="flex flex-wrap gap-2">
            {analysis.topCTAs.map(([cta, count]) => (
              <div
                key={cta}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]"
              >
                <span className="text-sm text-[var(--text-primary)]">{cta}</span>
                <span className="text-xs font-bold text-[var(--accent-yellow)]">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Common Phrases */}
      {analysis.topPhrases.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Recurring Phrases</h4>
          <div className="flex flex-wrap gap-2">
            {analysis.topPhrases.map(([phrase, count]) => (
              <div
                key={phrase}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]"
              >
                <span className="text-sm text-[var(--text-secondary)]">"{phrase}"</span>
                <span className="text-xs text-[var(--text-muted)]">×{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Word Cloud (simple bar version) */}
      {analysis.topWords.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Top Keywords</h4>
          <div className="space-y-1.5">
            {analysis.topWords.slice(0, 12).map(([word, count]) => {
              const percentage = (count / maxWordCount) * 100;
              return (
                <div key={word} className="flex items-center gap-2">
                  <div className="w-20 text-xs text-[var(--text-muted)] text-right truncate">{word}</div>
                  <div className="flex-1 h-5 bg-[var(--bg-tertiary)] rounded overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent-green)]/50 rounded transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="w-8 text-xs text-[var(--text-muted)] tabular-nums">{count}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats footer */}
      <div className="flex items-center justify-between pt-4 border-t border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
        <span>{analysis.totalAds} ads analyzed</span>
        <span>Avg. copy length: {analysis.avgLength} chars</span>
      </div>
    </div>
  );
}
