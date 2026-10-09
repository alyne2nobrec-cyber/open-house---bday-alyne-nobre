export interface ScrapedProduct {
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category?: string;
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
 */
export function extractTitleFromUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return '';

    const slug = segments.reduce((longest, curr) => {
      if (curr.length < 3 || /^\d+$/.test(curr)) return longest;
      return curr.length > longest.length ? curr : longest;
    }, '');

    if (!slug) return '';

    return decodeURIComponent(slug)
      .replace(/-|\_/g, ' ')
      .replace(/\.html?$/i, '')
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
      .slice(0, 80);
  } catch {
    return '';
  }
}

/**
 * Scrapes metadata from a given product URL.
 * First calls the server endpoint /api/scrape, and falls back to a resilient public resolver.
 */
export async function scrapeProductFromUrl(url: string): Promise<ScrapedProduct> {
  const cleanUrl = url.trim();
  const storeName = getStoreNameFromUrl(cleanUrl);
  const guessedTitle = extractTitleFromUrl(cleanUrl);

  const fallback: ScrapedProduct = {
    name: guessedTitle ? `${guessedTitle}` : `Item especial da ${storeName}`,
    description: `Presente escolhido com carinho na ${storeName}.`,
    price: 150,
    imageUrl: '',
    storeName,
    purchaseUrl: cleanUrl,
  };

  // 1. Try server-side endpoint first (no CORS, direct HTML parsing)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(`/api/scrape?url=${encodeURIComponent(cleanUrl)}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.name && !data.name.includes('Item especial')) {
        return {
          name: data.name,
          description: data.description || fallback.description,
          price: data.price > 0 ? data.price : fallback.price,
          imageUrl: data.imageUrl || '',
          category: data.category,
          storeName: data.storeName || storeName,
          purchaseUrl: cleanUrl,
        };
      }
    }
  } catch (err) {
    console.warn('Server scrape not reached or failed, trying public resolver:', err);
  }

  // 2. Client-side fallback via public CORS-friendly resolver
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const proxyUrl = `https://api.microlink.io?url=${encodeURIComponent(cleanUrl)}`;
    const res = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        const d = json.data;
        let title = d.title || '';
        const desc = d.description || '';
        let image = d.image?.url || '';

        // If title is generic Amazon "Galeria de produtos"
        if (!title || title.toLowerCase().includes('galeria') || title.toLowerCase().includes('amazon')) {
          const matchDesc =
            desc.match(/Compre online\s+([^-]+-[^.]+)/i) ||
            desc.match(/Compre online\s+(.*?)\s+na Amazon/i);
          if (matchDesc) {
            title = matchDesc[1].trim();
          } else if (d.url) {
            const canonicalMatch = decodeURIComponent(d.url).match(/\/([^\/]+)\/dp\//i);
            if (canonicalMatch) {
              title = canonicalMatch[1].replace(/[-_]/g, ' ').trim();
            }
          }
        }

        // Clean up title
        title = title.replace(/\s*:\s*Amazon\.com\.br.*$/i, '').trim();

        // Filter out 1x1 tracking pixel gifs from Amazon
        if (
          image.includes('uedata=') ||
          image.includes('fls-na') ||
          (d.image?.size && d.image.size < 200) ||
          (d.image?.height && d.image.height <= 2)
        ) {
          image = '';
        }

        // Infer category
        let category = 'casa';
        const text = `${title} ${desc}`.toLowerCase();
        if (text.match(/fog[aã]o|geladeira|panela|cafeteira|micro-ondas|air fryer|prato|copo|talher/i)) {
          category = 'cozinha';
        } else if (text.match(/sof[aá]|tv|quadro|tapete|almofada/i)) {
          category = 'sala';
        } else if (text.match(/cama|len[çc]ol|travesseiro|edredom/i)) {
          category = 'quarto';
        } else if (text.match(/toalha|chuveiro|saboneteira/i)) {
          category = 'banheiro';
        }

        return {
          name: (title || fallback.name).slice(0, 95),
          description: (desc || fallback.description).slice(0, 190),
          price: fallback.price,
          imageUrl: image,
          category,
          storeName: d.publisher || storeName,
          purchaseUrl: cleanUrl,
        };
      }
    }
  } catch (err) {
    console.log('Online scraping service timeout/block:', err);
  }

  return fallback;
}
