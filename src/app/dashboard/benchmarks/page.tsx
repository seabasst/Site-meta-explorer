import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import Link from 'next/link';
import { Plus, BarChart3, Users, Calendar, ArrowLeft } from 'lucide-react';
import { cookies } from 'next/headers';

interface BenchmarkBrand {
  id: string;
  pageName: string;
  isBaseline: boolean;
}

interface BenchmarkReport {
  id: string;
  name: string;
  createdAt: string;
  brands: BenchmarkBrand[];
}

async function getBenchmarks(): Promise<BenchmarkReport[]> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/benchmarks`, {
      headers: {
        Cookie: cookieHeader,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return data.reports || [];
  } catch {
    return [];
  }
}

export default async function BenchmarksPage() {
  const session = await auth();
  if (!session) redirect('/');

  const benchmarks = await getBenchmarks();

  return (
    <>
      <div className="gradient-mesh" />
      <div className="noise-overlay" />

      <main className="min-h-screen py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Back link */}
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">
                Benchmarks
              </h1>
              <p className="text-sm text-[var(--text-muted)]">
                Compare your brand against competitors
              </p>
            </div>
            <Link
              href="/dashboard/benchmarks/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--accent-green)] text-white font-medium rounded-lg hover:bg-[var(--accent-green-dark)] transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Benchmark
            </Link>
          </div>

          {/* Benchmarks list */}
          {benchmarks.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
                <BarChart3 className="w-8 h-8 text-[var(--text-muted)]" />
              </div>
              <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
                No benchmarks yet
              </h3>
              <p className="text-sm text-[var(--text-muted)] mb-6 max-w-sm mx-auto">
                Create your first benchmark to compare your brand against competitors
              </p>
              <Link
                href="/dashboard/benchmarks/new"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--accent-green)] text-white font-medium rounded-lg hover:bg-[var(--accent-green-dark)] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Your First Benchmark
              </Link>
            </div>
          ) : (
            <div className="grid gap-4">
              {benchmarks.map((benchmark) => {
                const baselineBrand = benchmark.brands.find((b) => b.isBaseline);
                const competitorCount = benchmark.brands.filter((b) => !b.isBaseline).length;
                const createdDate = new Date(benchmark.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });

                return (
                  <Link
                    key={benchmark.id}
                    href={`/dashboard/benchmarks/${benchmark.id}`}
                    className="glass rounded-xl p-5 hover:border-[var(--accent-green)] transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--accent-green-light)] transition-colors">
                          {benchmark.name}
                        </h3>

                        {baselineBrand && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs px-2 py-0.5 rounded bg-[var(--accent-green)]/20 text-[var(--accent-green-light)]">
                              Baseline
                            </span>
                            <span className="text-sm text-[var(--text-muted)] truncate">
                              {baselineBrand.pageName}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-4 shrink-0 text-sm text-[var(--text-muted)]">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-4 h-4" />
                          <span>{competitorCount} competitor{competitorCount !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          <span>{createdDate}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
