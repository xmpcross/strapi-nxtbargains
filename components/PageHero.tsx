import type { ReactNode } from 'react';

export default function PageHero({
  eyebrow,
  title,
  sub,
  children,
  titleClassName = '',
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  children?: ReactNode;
  titleClassName?: string;
}) {
  return (
    <section className="relative overflow-hidden pb-5 pt-16 sm:pt-[72px]">
      <div aria-hidden className="pointer-events-none absolute -top-40 -right-[150px] z-0 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(0,70,190,0.13),transparent_62%)]" />
      <div className="relative z-[2] mx-auto max-w-[1366px] px-6">
        <span className="text-[0.74rem] font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</span>
        <h1 className={`mt-3.5 font-display font-extrabold leading-[1.04] tracking-[-0.03em] text-ink ${titleClassName}`}>{title}</h1>
        {sub && <p className="mt-[18px] max-w-[56ch] text-[1.12rem] leading-[1.6] text-ink/55">{sub}</p>}
        {children}
      </div>
    </section>
  );
}
