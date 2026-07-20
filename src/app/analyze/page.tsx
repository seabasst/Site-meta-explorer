import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AnalyzeClient } from './analyze-client';

export const metadata: Metadata = {
  title: 'Analyze — Facebook Ad Intelligence',
  description: 'Search a competitor or a category to see their best-performing ads, best copy, and creator partnerships.',
};

export default function AnalyzePage() {
  return (
    <Suspense fallback={null}>
      <AnalyzeClient />
    </Suspense>
  );
}
