'use client';

import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';

// Shown instead of any /dashboard page until the visitor accepts. Meta Platform Terms 3.c.ii.4 lets us share
// Ad Library data with third parties only if they are bound to terms that bar misuse and make them follow
// Meta's Terms. Same wording as the report gate (meta-ad-library-account-analysis skill, assets/terms-gate.html);
// change both together and bump the cookie value in ./terms-gated.tsx.
const TERMS = [
  'Use the data for your own analysis only.',
  'Don’t sell, license or redistribute the data or datasets built from it.',
  'Don’t scrape or bulk download it.',
];

export function TermsGate({ cookie }: { cookie: string }) {
  const router = useRouter();

  function accept() {
    document.cookie = `${cookie}; Max-Age=31536000; Path=/; SameSite=Lax`;
    router.refresh();
  }

  return (
    <main
      className="grid min-h-[100dvh] place-items-center bg-[#FAF9F7] px-4 py-10 text-stone-900 antialiased"
      style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}
    >
      <div className="w-full max-w-[480px] rounded-[28px] bg-white p-7 shadow-[0_30px_80px_-20px_rgba(28,25,23,0.25)] ring-1 ring-stone-200/70 md:p-9">
        <div className="flex items-center gap-2.5">
          <span className="h-6 w-6 rounded-[9px] bg-rose-600" aria-hidden />
          <span className="text-[17px] font-semibold tracking-[-0.03em]">genome</span>
          <span className="text-xs text-stone-400">by KiriMedia</span>
        </div>
        <h1 className="mt-7 text-2xl font-semibold leading-tight tracking-[-0.02em]">Before you look around</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-stone-600">
          The ad data in Genome comes from Meta&apos;s Ad Library. KiriMedia shares it on these terms:
        </p>
        <ul className="mt-5 space-y-3 text-[15px] text-stone-800">
          {TERMS.map((t) => (
            <li key={t} className="flex gap-3"><Check size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-rose-600" />{t}</li>
          ))}
          <li className="flex gap-3">
            <Check size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-rose-600" />
            <span>
              Follow{' '}
              <a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-rose-700">
                Meta Platform Terms
              </a>
              , which also apply to you.
            </span>
          </li>
        </ul>
        <p className="mt-5 text-sm text-stone-500">Ad images, videos and copy belong to their advertisers.</p>
        <button
          onClick={accept}
          autoFocus
          className="mt-7 w-full rounded-full bg-rose-600 py-3.5 text-[15px] font-medium text-white transition hover:bg-rose-700 active:scale-[0.99]"
        >
          I agree
        </button>
        <p className="mt-3 text-center text-xs text-stone-400">We remember your choice in this browser.</p>
      </div>
    </main>
  );
}
