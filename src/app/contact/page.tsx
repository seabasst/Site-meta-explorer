import Link from 'next/link';

export const metadata = {
  title: 'Contact Us - Facebook Ad Library Analyser',
  description: 'Get in touch with the Facebook Ad Library Analyser team.',
};

export default function ContactPage() {
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
        Contact <span className="text-[var(--accent-green-light)] italic">Us</span>
      </h1>

      <div className="space-y-6 text-[var(--text-secondary)] leading-relaxed">
        <p>
          Have a question, partnership inquiry, or just want to say hello? We&apos;d love to hear from you.
        </p>

        <div className="glass rounded-xl p-6 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1">Email</h3>
            <a
              href="mailto:sebastian@kirimedia.co"
              className="text-[var(--accent-green-light)] hover:underline"
            >
              sebastian@kirimedia.co
            </a>
          </div>

          <div>
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1">Bug Reports &amp; Feature Requests</h3>
            <p className="text-sm">
              Use our <Link href="/feedback" className="text-[var(--accent-green-light)] hover:underline">feedback page</Link> to report bugs or suggest features. We read every submission.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1">Response Time</h3>
            <p className="text-sm">
              We typically respond within 24-48 hours on business days.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
