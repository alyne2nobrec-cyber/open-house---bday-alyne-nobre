export interface ScrapedProduct {
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  storeName: string;
  purchaseUrl: string;
}

/**
 * Extracts a human-friendly store name from URL
 */
export function getStoreNameFromUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    const host = url.hostname.replace('www.', '');
    const parts = host.split('.');
    const primary = parts[0] || '';

    const map: Record<string, string> = {
      amazon: 'Amazon Brasil',
      magazineluiza: 'Magazine Luiza',
      mercadolivre: 'Mercado Livre',
      tokstok: 'Tok&Stok',
      westwing: 'Westwing',
      camicado: 'Camicado',
      zarahome: 'Zara Home',
      mobly: 'Mobly',
      etna: 'Etna',
      shopee: 'Shopee',
      casasbahia: 'Casas Bahia',
      leroymerlin: 'Leroy Merlin',
      spicy: 'Spicy Gourmet',
    };

    return map[primary.toLowerCase()] || (primary.charAt(0).toUpperCase() + primary.slice(1));
  } catch {
    return 'Loja Online';
  }
}

/**
 * Tries to parse human title from the URL path slugs
 * e.g. /geladeira-frost-free-brastemp-brm44hk/p -> "Geladeira Frost Free Brastemp Brm44hk"
 */
export function extractTitleFromUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return '';

    // Take the longest or most descriptive slug segment
    const slug = segments.reduce((longest, curr) => {
      // filter out /p, /dp, /item, IDs
      if (curr.length < 3 || /^\d+$/.test(curr)) return longest;
      return curr.length > longest.length ? curr : longest;
    }, '');

    if (!slug) return '';

    return slug
      .replace(/-|\_/g, ' ')
      .replace(/\.html?$/i, '')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
      .slice(0, 70);
  } catch {
    return '';
  }
}

/**
 * Scrapes metadata from a given product URL.
 * Uses resilient proxies and fallbacks to ensure it never throws a blocking error.
 */
export async function scrapeProductFromUrl(url: string): Promise<ScrapedProduct> {
  const storeName = getStoreNameFromUrl(url);
  const guessedTitle = extractTitleFromUrl(url);

  const fallback: ScrapedProduct = {
    name: guessedTitle ? `${guessedTitle}` : `Item especial da ${storeName}`,
    description: `Presente escolhido com carinho na ${storeName}.`,
    price: 150,
    imageUrl: '',
    storeName,
    purchaseUrl: url,
  };

  try {
    // Attempt through public CORS-friendly OpenGraph resolver
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const proxyUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        const d = json.data;
        const ogTitle = d.title || fallback.name;
        const ogDesc = d.description || fallback.description;
        const ogImage = d.image?.url || '';

        return {
          name: ogTitle.slice(0, 90),
          description: ogDesc.slice(0, 180),
          price: fallback.price,
          imageUrl: ogImage,
          storeName: d.publisher || storeName,
          purchaseUrl: url,
        };
      }
    }
  } catch (err) {
    console.log('Online scraping service timeout/block (using smart fallback):', err);
  }

  return fallback;
}
