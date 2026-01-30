import Link from 'next/link';

export const metadata = {
  title: 'About Us - Facebook Ad Library Analyser',
  description: 'Learn about the Facebook Ad Library Analyser and the team behind it.',
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mb-10"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Analyser
      </Link>

      <h1 className="font-serif text-4xl text-[var(--text-primary)] mb-6 tracking-tight">
        About <span className="text-[var(--accent-green-light)] italic">Us</span>
      </h1>

      <div className="space-y-6 text-[var(--text-secondary)] leading-relaxed">
        <p>
          Facebook Ad Library Analyser is a competitive intelligence tool that helps marketers, brands, and agencies understand what their competitors are doing on Facebook and Instagram.
        </p>

        <p>
          We pull data directly from the official Facebook Ad Library API and transform it into actionable insights — demographics breakdowns, ad copy analysis, media type trends, landing page tracking, and more.
        </p>

        <h2 className="font-serif text-2xl text-[var(--text-primary)] pt-4">
          Why we built this
        </h2>
        <p>
          The Facebook Ad Library is public, but navigating it is painful. You can browse ads one by one, but there&apos;s no way to see the bigger picture — who a brand is targeting, what creatives are working, or how their strategy has evolved over time.
        </p>
        <p>
          We built this tool to close that gap. Paste a URL, get a full competitive breakdown in seconds.
        </p>

        <h2 className="font-serif text-2xl text-[var(--text-primary)] pt-4">
          Data &amp; Privacy
        </h2>
        <p>
          All ad data comes from Facebook&apos;s public Ad Library API. Demographic data is available for EU-targeted ads under the Digital Services Act (DSA) transparency requirements. We do not collect or store any personal data from the ads we analyse.
        </p>
      </div>
    </div>
  );
}
