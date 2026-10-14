import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GALLERY_FILE = path.resolve(__dirname, 'data/galleryMedia.json');

function readGalleryFromFile(): any[] {
  try {
    if (!fs.existsSync(GALLERY_FILE)) return [];
    const raw = fs.readFileSync(GALLERY_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Error reading gallery file:', err);
    return [];
  }
}

function writeGalleryToFile(items: any[]): void {
  try {
    const dir = path.dirname(GALLERY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(GALLERY_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing gallery file:', err);
  }
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (!normalized || normalized === 'localhost') return true;
  if (normalized === '127.0.0.1' || normalized === '::1') return true;
  if (normalized.endsWith('.localhost')) return true;
  const parts = normalized.split('.');
  if (parts.length >= 4) {
    const [a, b, c, d] = parts.map((n) => Number.parseInt(n, 10));
    if ([a, b, c, d].every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
      if (a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 0) {
        return true;
      }
      if (a === 100 && b >= 64 && b <= 127) return true;
      if (a === 198 && (b === 18 || b === 19)) return true;
      if (a === 203 && b === 0 && c === 113) return true;
    }
  }
  return false;
}

function getStoreNameFromUrl(urlString: string): string {
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

async function scrapeServerSide(targetUrl: string) {
  const storeName = getStoreNameFromUrl(targetUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);

  try {
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
        'Cache-Control': 'no-cache',
      },
    });
    clearTimeout(timeoutId);

    const html = await res.text();

    let title = '';
    let imageUrl = '';
    let price = 0;
    let description = '';

    // Amazon specific selectors
    if (targetUrl.includes('amazon.')) {
      const titleMatch = html.match(/id="productTitle"[^>]*>([\s\S]*?)<\/span>/i);
      if (titleMatch) title = titleMatch[1].trim();

      const imgMatch =
        html.match(/data-old-hires="([^"]+)"/i) ||
        html.match(/id="landingImage"[^>]*src="([^"]+)"/i) ||
        html.match(/id="imgBlkFront"[^>]*src="([^"]+)"/i);
      if (imgMatch) imageUrl = imgMatch[1];

      const priceMatch = html.match(/class="a-price-whole">([\s\S]*?)<\/span>/i);
      if (priceMatch) {
        const clean = priceMatch[1].replace(/[^\d]/g, '');
        if (clean) price = Number(clean);
      }
    }

    // Mercado Livre specific
    if (targetUrl.includes('mercadolivre.')) {
      const mlTitle = html.match(/<h1[^>]*class="[^"]*ui-pdp-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i);
      if (mlTitle) title = mlTitle[1].trim();

      const mlImg = html.match(/<img[^>]*class="[^"]*ui-pdp-image[^"]*"[^>]*src="([^"]+)"/i);
      if (mlImg) imageUrl = mlImg[1];

      const mlPrice = html.match(/<span[^>]*class="[^"]*andes-money-amount__fraction[^"]*"[^>]*>([\d.]+)/i);
      if (mlPrice) price = Number(mlPrice[1].replace(/\./g, ''));
    }

    // Generic OpenGraph / Meta fallback
    if (!title) {
      const ogTitle =
        html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
        html.match(/<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i) ||
        html.match(/<title>([^<]+)<\/title>/i);
      if (ogTitle) title = ogTitle[1].trim();
    }

    if (!imageUrl) {
      const ogImg =
        html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
        html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
      if (ogImg && !ogImg[1].includes('uedata=') && !ogImg[1].includes('fls-na')) {
        imageUrl = ogImg[1];
      }
    }

    if (!description) {
      const ogDesc =
        html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
        html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
      if (ogDesc) description = ogDesc[1].trim();
    }

    // Amazon title cleanups
    if (title) {
      title = title
        .replace(/\s*:\s*Amazon\.com\.br.*$/i, '')
        .replace(/^Galeria de produtos/i, '')
        .trim();
    }

    if (!title && description && description.includes('Compre online')) {
      const m =
        description.match(/Compre online\s+(.*?)\s+na Amazon/i) ||
        description.match(/Compre online\s+([^-]+-[^.]+)/i);
      if (m) title = m[1].trim();
    }

    // Category inference
    let category = 'casa';
    const textToCheck = `${title} ${description}`.toLowerCase();
    if (textToCheck.match(/fog[aã]o|geladeira|panela|cafeteira|micro-ondas|air fryer|liquidificador|prato|talher/i)) {
      category = 'cozinha';
    } else if (textToCheck.match(/sof[aá]|tv|quadro|tapete|almofada|rack|estante/i)) {
      category = 'sala';
    } else if (textToCheck.match(/cama|len[çc]ol|travesseiro|edredom|guarda-roupa/i)) {
      category = 'quarto';
    } else if (textToCheck.match(/toalha|chuveiro|saboneteira|espelho/i)) {
      category = 'banheiro';
    }

    return {
      name: title || `Item especial da ${storeName}`,
      description: description || `Presente escolhido com carinho na ${storeName}.`,
      price: price > 0 ? price : 150,
      imageUrl: imageUrl || '',
      category,
      storeName,
      purchaseUrl: targetUrl,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Cloudinary public config check
  app.get('/api/cloudinary/config', (_req, res) => {
    return res.json({
      cloudName: process.env.VITE_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || '',
      uploadPreset: process.env.VITE_CLOUDINARY_UPLOAD_PRESET || process.env.CLOUDINARY_UPLOAD_PRESET || '',
      configured: Boolean(
        (process.env.VITE_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME) &&
        (process.env.VITE_CLOUDINARY_UPLOAD_PRESET || process.env.CLOUDINARY_UPLOAD_PRESET)
      ),
    });
  });

  // Gallery media endpoints (Cloudinary-hosted files, server-persisted metadata)
  app.get('/api/gallery', (_req, res) => {
    const items = readGalleryFromFile();
    items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return res.json(items);
  });

  app.post('/api/gallery', (req, res) => {
    const { type, url, thumbnailUrl, caption, order, fileName, fileSize, publicId } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL do arquivo é obrigatória.' });
    }

    const items = readGalleryFromFile();
    const newItem = {
      id: `media_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      type: type === 'video' ? 'video' : 'image',
      url,
      thumbnailUrl: thumbnailUrl || null,
      caption: caption || '',
      order: typeof order === 'number' ? order : items.length,
      fileName: fileName || null,
      fileSize: fileSize || null,
      publicId: publicId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    items.push(newItem);
    writeGalleryToFile(items);
    return res.status(201).json(newItem);
  });

  app.put('/api/gallery/reorder', (req, res) => {
    const { items: newOrderItems } = req.body;
    if (!Array.isArray(newOrderItems)) {
      return res.status(400).json({ error: 'Array "items" é obrigatório.' });
    }

    const currentItems = readGalleryFromFile();
    const itemMap = new Map(currentItems.map((it) => [it.id, it]));

    const reordered = newOrderItems.map((incoming, idx) => {
      const existing = itemMap.get(incoming.id) || incoming;
      return {
        ...existing,
        order: idx,
        updatedAt: new Date().toISOString(),
      };
    });

    writeGalleryToFile(reordered);
    return res.json({ success: true, items: reordered });
  });

  app.put('/api/gallery/:id', (req, res) => {
    const { id } = req.params;
    const { caption, order, thumbnailUrl } = req.body;

    const items = readGalleryFromFile();
    const idx = items.findIndex((it) => it.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Item não encontrado na galeria.' });
    }

    if (typeof caption === 'string') items[idx].caption = caption;
    if (typeof order === 'number') items[idx].order = order;
    if (typeof thumbnailUrl === 'string') items[idx].thumbnailUrl = thumbnailUrl;
    items[idx].updatedAt = new Date().toISOString();

    writeGalleryToFile(items);
    return res.json(items[idx]);
  });

  app.delete('/api/gallery/:id', (req, res) => {
    const { id } = req.params;
    const items = readGalleryFromFile();
    const filtered = items.filter((it) => it.id !== id);
    writeGalleryToFile(filtered);
    return res.json({ success: true });
  });

  // API endpoint for product scraping
  app.get('/api/scrape', async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).json({ error: 'URL param is required' });
    }

    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return res.status(400).json({ error: 'URL inválida.' });
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Só são permitidas URLs HTTP/HTTPS.' });
    }

    if (isPrivateOrLocalHost(parsed.hostname)) {
      return res.status(403).json({ error: 'Acesso bloqueado para hosts locais ou privados.' });
    }

    const adminHeader = req.headers.authorization || '';
    const adminToken = process.env.ADMIN_API_TOKEN || 'admin-change-me';
    if (!adminHeader || adminHeader !== `Bearer ${adminToken}`) {
      return res.status(401).json({ error: 'Autenticação exigida.' });
    }

    try {
      const product = await scrapeServerSide(targetUrl);
      return res.json(product);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error scraping';
      return res.status(500).json({ error: msg });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server ready on http://0.0.0.0:${PORT}`);
  });
}

startServer();
