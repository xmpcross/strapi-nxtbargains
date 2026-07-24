import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Us',
  description: 'About NXT.Bargains — independent price comparison for smart electronics.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return <div data-testid="about-page" />;
}
