import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { BenchmarkCreateForm } from '@/components/benchmark/benchmark-create-form';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function NewBenchmarkPage() {
  const session = await auth();
  if (!session) redirect('/');

  return (
    <>
      <div className="gradient-mesh" />
      <div className="noise-overlay" />

      <main className="min-h-screen py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Back link */}
          <Link
            href="/dashboard/benchmarks"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Benchmarks
          </Link>

          {/* Header */}
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            Create Benchmark
          </h1>
          <p className="text-[var(--text-muted)] mb-6">
            Compare up to 5 competitors against your baseline brand
          </p>

          {/* Form */}
          <BenchmarkCreateForm />
        </div>
      </main>
    </>
  );
}
