import { V2Provider } from './v2-context';

export const metadata = {
  title: 'Ad Library Pro | Dashboard',
};

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return <V2Provider>{children}</V2Provider>;
}
