import { TermsGated } from '@/components/terms/terms-gated';

export default function AnalyserLayout({ children }: { children: React.ReactNode }) {
  return <TermsGated>{children}</TermsGated>;
}
