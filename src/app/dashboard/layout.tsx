import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard | Ad Analyser',
  description: 'Track your brand and competitors with side-by-side comparison and historical trends.',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
