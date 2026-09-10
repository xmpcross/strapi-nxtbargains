import type { Metadata } from 'next';
import PillarRoute, { pillarMetadata } from '@/components/pillar/PillarRoute';

const PILLAR_POST_SLUG = 'coupon-codes-101-best-deals-and-bargains';
const PILLAR_PATH = '/coupon-codes';

export const revalidate = 60;

export function generateMetadata(): Promise<Metadata> {
  return pillarMetadata(PILLAR_POST_SLUG, PILLAR_PATH);
}

export default function Page() {
  return <PillarRoute slug={PILLAR_POST_SLUG} breadcrumbLabel="Coupon codes" />;
}
