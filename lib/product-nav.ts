/**
 * The product category tree, shared by the header menu and the filter sidebar.
 *
 * The commerce taxonomy in Strapi is flat — every category is a sibling, with
 * no parent relation populated — but the header groups four of them under
 * "Smart Home" because a dozen flat entries in one menu is hard to scan. That
 * grouping is editorial, so it lives here rather than being inferred.
 *
 * It exists as one exported tree because it was previously written out inside
 * Header.tsx alone. The sidebar rendered its own flat list straight from
 * Strapi, so the two disagreed: the menu showed Smart Doorbells nested under
 * Smart Home, the sidebar showed it loose between Smart Plugs and Headphones,
 * and adding a category meant editing one and forgetting the other.
 *
 * Order is deliberate — roughly by how much of the catalogue each holds — and
 * is what both surfaces render, rather than alphabetical or count-sorted.
 */
export type ProductNavNode =
  | { slug: string; label: string }
  | { label: string; children: Array<{ slug: string; label: string }> };

export const PRODUCT_CATEGORY_TREE: ProductNavNode[] = [
  { slug: 'smart-phones', label: 'Smart Phones' },
  { slug: 'smartwatches', label: 'Smartwatches' },
  { slug: 'tablets', label: 'Tablets' },
  { slug: 'laptops', label: 'Laptops' },
  { slug: 'smart-tvs', label: 'Smart TVs' },
  { slug: 'smart-cameras', label: 'Smart Cameras' },
  { slug: 'smart-speakers', label: 'Smart Speakers' },
  {
    label: 'Smart Home',
    children: [
      { slug: 'smart-light-bulbs', label: 'Smart Light Bulbs' },
      { slug: 'smart-door-locks', label: 'Smart Door Locks' },
      { slug: 'smart-plugs', label: 'Smart Plugs' },
      { slug: 'smart-doorbells', label: 'Smart Doorbells' },
    ],
  },
  { slug: 'headphones', label: 'Headphones' },
  { slug: 'raspberry-pi', label: 'Raspberry PI' },
];

/** Every category slug in the tree, parents included, in render order. */
export function productNavSlugs(): string[] {
  return PRODUCT_CATEGORY_TREE.flatMap((node) =>
    'children' in node ? node.children.map((child) => child.slug) : [node.slug]);
}
