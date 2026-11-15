import { cookies } from 'next/headers';
import { TermsGate } from './terms-gate';

// Wrap every layout whose pages show Ad Library data (/dashboard, which includes Genome, and /analyser).
// Checked on the server so no data reaches the browser before the visitor accepts.
// ponytail: the /api routes behind these pages stay open; check this cookie there too if that matters.
const TERMS = { name: 'kiri_data_terms', value: 'v1' };

export async function TermsGated({ children }: { children: React.ReactNode }) {
  const accepted = (await cookies()).get(TERMS.name)?.value === TERMS.value;
  return accepted ? <>{children}</> : <TermsGate cookie={`${TERMS.name}=${TERMS.value}`} />;
}
