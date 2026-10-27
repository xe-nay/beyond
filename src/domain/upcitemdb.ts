// UPCitemdb: names, brands and photos for barcodes from many countries, no key needed (100 lookups a
// day). It has no nutrition values: a product it knows is searched by name, or created with its name.
export interface Named { name: string; brand: string | null; image: string | null }

export async function upcName(code: string, signal?: AbortSignal): Promise<Named | null> {
  const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`, { signal });
  if (!res.ok) return null;
  const body = await res.json();
  const it = body?.items?.[0];
  const name = String(it?.title ?? '').trim();
  if (!name) return null;
  return { name, brand: it.brand ? String(it.brand) : null, image: Array.isArray(it.images) && it.images[0] ? String(it.images[0]) : null };
}
