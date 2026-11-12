import Link from 'next/link';
import { auth } from '@/auth';
import { MCP_DAILY_REQUEST_CAP, MCP_TERMS_VERSION } from '@/lib/mcp-keys';
import { KeyForm } from './key-form';

export const metadata = {
  title: 'Benchmark MCP terms - Genome',
  description: 'Terms of use for the free Meta ad benchmark MCP server.',
};

// Section 3.c.ii.4.a of Meta's Platform Terms lets us share Platform Data with third parties only
// after they are contractually bound not to use it in breach of those Terms. An API key is issued
// only to a signed-in user who ticks "I accept" below, so do not remove the Meta clauses, and bump
// MCP_TERMS_VERSION in src/lib/mcp-keys.ts whenever this text changes.
export default async function McpTermsPage() {
  const session = await auth();

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mb-10"
      >
        Back
      </Link>

      <h1 className="font-serif text-4xl text-[var(--text-primary)] mb-6 tracking-tight">
        Benchmark MCP terms of use
      </h1>

      <div className="space-y-6 text-[var(--text-secondary)] leading-relaxed">
        <p>
          KiriMedia provides a free MCP server with industry benchmarks for how long Meta ads run and how
          often advertisers stop them. Access requires a personal API key. By requesting or using a key you
          accept these terms.
        </p>
        <p className="text-sm text-[var(--text-muted)]">Version {MCP_TERMS_VERSION}</p>

        <h2 className="font-serif text-2xl text-[var(--text-primary)] pt-4">Where the data comes from</h2>
        <p>
          The benchmarks are aggregated from Meta&apos;s Ad Library API. They count as Platform Data under{' '}
          <a className="underline" href="https://developers.facebook.com/terms/">Meta&apos;s Platform Terms</a>,
          including in aggregated form.
        </p>

        <h2 className="font-serif text-2xl text-[var(--text-primary)] pt-4">What you agree to</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>You will not use the data in any way that would violate Meta&apos;s Platform Terms or Developer Policies.</li>
          <li>You will not sell, license or purchase the data, or offer it as part of a paid data product.</li>
          <li>You will not attempt to re-identify advertisers or people from the data.</li>
          <li>You will not republish the benchmark data in bulk. You may use results in your own analyses and reports.</li>
          <li>Your key is personal. Do not share it. We may revoke a key at any time.</li>
          <li>
            Each key allows {MCP_DAILY_REQUEST_CAP} requests per day (UTC). One key per person: getting a new key
            revokes your previous one.
          </li>
        </ul>

        <h2 className="font-serif text-2xl text-[var(--text-primary)] pt-4">What the data is not</h2>
        <p>
          Ad lifespan shows what advertisers kept running and what Meta kept delivering. It does not measure
          profit. The benchmarks are provided as is, without warranty, and may change or be withdrawn.
        </p>

        <h2 id="key" className="font-serif text-2xl text-[var(--text-primary)] pt-4">Get your key</h2>
        {session?.user ? (
          <>
            <p>Signed in as {session.user.email}. The key is tied to this account.</p>
            <KeyForm termsVersion={MCP_TERMS_VERSION} />
          </>
        ) : (
          <p>
            <Link className="btn-primary inline-block px-6 py-3" href="/auth/signin?callbackUrl=%2Fmcp%2Fterms%23key">
              Sign in with Google to get a key
            </Link>
          </p>
        )}

        <h2 className="font-serif text-2xl text-[var(--text-primary)] pt-4">Connect</h2>
        <p>Claude Code, key in a header:</p>
        <code className="block p-3 rounded-lg bg-[var(--bg-tertiary)] break-all text-sm">
          claude mcp add --transport http kiri-benchmarks https://genome.kirimedia.co/api/mcp --header &quot;Authorization: Bearer &lt;key&gt;&quot;
        </code>
        <p>
          claude.ai has no header field for custom connectors, so the key goes in the URL. Settings, Connectors,
          Add custom connector, and use as the server URL:
        </p>
        <code className="block p-3 rounded-lg bg-[var(--bg-tertiary)] break-all text-sm">
          https://genome.kirimedia.co/api/mcp/&lt;key&gt;
        </code>
        <p className="text-sm text-[var(--text-muted)]">
          A URL with the key in it is as secret as the key. Do not paste it anywhere others can see it.
        </p>

        <p className="pt-4">
          Questions: <Link className="underline" href="/contact">contact us</Link>.
        </p>
      </div>
    </div>
  );
}
