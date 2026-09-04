'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

export default function Geniuslink() {
  const [ready, setReady] = useState(false);
  const tsid = Number(process.env.NEXT_PUBLIC_GENIUSLINK_TSID);

  useEffect(() => {
    if (!ready || !Number.isSafeInteger(tsid) || tsid <= 0) return;
    const convert = () => {
      const genius = (window as Window & {
        Genius?: { convertLinks: (id: number, passDtb: boolean, domain: string) => void };
      }).Genius;
      genius?.convertLinks(tsid, false, 'buy.geni.us');
    };
    convert();
    let timer: ReturnType<typeof setTimeout>;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(convert, 100);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
    return () => { observer.disconnect(); clearTimeout(timer); };
  }, [ready, tsid]);

  if (!Number.isSafeInteger(tsid) || tsid <= 0) return null;
  return <Script src="https://geniuslinkcdn.com/snippet.min.js" strategy="afterInteractive" onReady={() => setReady(true)} />;
}
