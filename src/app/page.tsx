import { LandingNav } from '@/components/landing/landing-nav';
import { HeroSection } from '@/components/landing/hero-section';
import { FeatureShowcase } from '@/components/landing/feature-showcase';
import { V2PreviewSection } from '@/components/landing/v2-preview-section';
import { PricingSection } from '@/components/landing/pricing-section';
import { LandingFooter } from '@/components/landing/landing-footer';

export const metadata = {
  title: 'Ad Library Pro — Competitive Ad Intelligence',
  description:
    'Browse, save, and analyze competitor Facebook ads. Free analyser tool plus Pro dashboard with AI-powered insights for $99/month.',
};

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <LandingNav />
      <HeroSection />
      <FeatureShowcase />
      <V2PreviewSection />
      <PricingSection />
      <LandingFooter />
    </main>
  );
}
