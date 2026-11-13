import type { Metadata } from 'next';
import { TermsGated } from '@/components/terms/terms-gated';

export const metadata: Metadata = {
  title: 'Dashboard | Ad Analyser',
  description: 'Track your brand and competitors with side-by-side comparison and historical trends.',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <TermsGated>{children}</TermsGated>;
}
