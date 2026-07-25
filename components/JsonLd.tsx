/**
 * Renders schema.org structured data as a single JSON-LD `<script>` using an
 * `@graph`, composed from the builders in `lib/jsonld.ts`.
 *
 *   import { organizationJsonLd, websiteJsonLd, articleJsonLd, breadcrumbJsonLd, faqJsonLd } from '@/lib/jsonld';
 *
 *   <JsonLd graph={[
 *     organizationJsonLd(),
 *     websiteJsonLd(),
 *     articleJsonLd({ ... }),
 *     breadcrumbLd,
 *     faqLd,            // may be null — dropped automatically
 *   ]} />
 *
 * - `null`/`undefined` entries are dropped, so a page can pass conditional schema
 *   (e.g. `faqLd`) without guarding.
 * - Each builder returns its own `'@context'`; here it's stripped and a single
 *   shared context is emitted (the standard @graph shape). A single-entry graph
 *   renders the object directly (no `@graph` wrapper) for maximum compatibility.
 *
 * Adding a new schema type to a template is a one-line change to the array.
 */
export function JsonLd({ graph }: { graph: Array<Record<string, unknown> | null | undefined> }) {
  const items = graph
    .filter((node): node is Record<string, unknown> => Boolean(node))
    .map(({ ['@context']: _context, ...rest }) => rest);

  if (items.length === 0) return null;

  const data =
    items.length === 1
      ? { '@context': 'https://schema.org', ...items[0] }
      : { '@context': 'https://schema.org', '@graph': items };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

export default JsonLd;
