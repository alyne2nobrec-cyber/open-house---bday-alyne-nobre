import { GiftCategory, GiftType } from '../types';

export interface ParsedCsvGift {
  name: string;
  description: string;
  category: GiftCategory;
  type: GiftType;
  price: number;
  totalQuantity: number;
  purchaseUrl?: string;
  pixKey?: string;
  imageUrl: string;
  line: number;
}

export interface GiftCsvParseResult {
  gifts: ParsedCsvGift[];
  totalRows: number;
  errors: string[];
}

/**
 * Normalizes text to lowercase without accents
 */
function cleanStr(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Splits a CSV line taking quotes into account
 */
function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      result.push(current.trim().replace(/^"|"$/g, '').trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, '').trim());
  return result;
}

/**
 * Detects the most probable delimiter (; or , or \t)
 */
function detectDelimiter(text: string): string {
  const firstLines = text.split(/\r?\n/).slice(0, 5).join('\n');
  const semicolons = (firstLines.match(/;/g) || []).length;
  const commas = (firstLines.match(/,/g) || []).length;
  const tabs = (firstLines.match(/\t/g) || []).length;

  if (semicolons >= commas && semicolons >= tabs && semicolons > 0) return ';';
  if (tabs > commas && tabs > semicolons) return '\t';
  return ',';
}

/**
 * Parses and normalizes gift category
 */
function parseCategory(raw?: string): GiftCategory {
  if (!raw) return 'outros';
  const clean = cleanStr(raw);
  if (clean.includes('cozinh')) return 'cozinha';
  if (clean.includes('sal')) return 'sala';
  if (clean.includes('quart')) return 'quarto';
  if (clean.includes('banh')) return 'banheiro';
  if (clean === 'casa' || clean.includes('casa')) return 'casa';
  if (clean.includes('pix')) return 'pix';
  if (clean.includes('outr')) return 'outros';
  return 'outros';
}

/**
 * Parses and normalizes gift type
 */
function parseType(raw?: string, purchaseUrl?: string, pixKey?: string): GiftType {
  const clean = raw ? cleanStr(raw) : '';
  if (clean === 'produto' || clean === 'product') return 'product';
  if (clean === 'pix') return 'pix';
  if (clean === 'cota' || clean === 'cotas' || clean === 'shares' || clean === 'share') return 'shares';
  if (clean === 'externo' || clean === 'external' || clean === 'link' || clean === 'loja') return 'external';
  if (clean === 'outro' || clean === 'outros' || clean === 'other') return 'other';

  // Fallback heuristic based on provided fields
  if (purchaseUrl && purchaseUrl.trim().length > 0) return 'external';
  if (pixKey && pixKey.trim().length > 0) return 'pix';
  return 'product';
}

/**
 * Parses price from diverse currency formats (e.g. "R$ 1.234,56", "1234,56", "1234.56", "150")
 */
function parsePrice(raw?: string): number {
  if (!raw) return 0;
  let val = raw.trim().replace(/^R\$\s*/i, '').trim();
  if (!val) return 0;

  if (val.includes('.') && val.includes(',')) {
    const lastDot = val.lastIndexOf('.');
    const lastComma = val.lastIndexOf(',');
    if (lastComma > lastDot) {
      val = val.replace(/\./g, '').replace(',', '.');
    } else {
      val = val.replace(/,/g, '');
    }
  } else if (val.includes(',')) {
    val = val.replace(',', '.');
  }

  val = val.replace(/[^\d.]/g, '');
  const num = parseFloat(val);
  return isNaN(num) || num < 0 ? 0 : Math.round(num * 100) / 100;
}

/**
 * Parses quantity ensuring an integer >= 1
 */
function parseQuantity(raw?: string): number {
  if (!raw) return 1;
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return 1;
  const num = parseInt(digits, 10);
  return isNaN(num) || num < 1 ? 1 : num;
}

/**
 * Ensures valid HTTP/HTTPS URL
 */
function normalizeUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Ensures valid image URL or local asset path
 */
function normalizeImageUrl(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Parses CSV content into list of valid gifts, tracking row numbers and errors
 */
export function parseGiftsCsv(csvContent: string): GiftCsvParseResult {
  const sanitized = csvContent.replace(/^\uFEFF/, '');
  const rawLines = sanitized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (rawLines.length === 0) {
    return { gifts: [], totalRows: 0, errors: ['O arquivo está vazio.'] };
  }

  const delimiter = detectDelimiter(sanitized);
  const rows = rawLines.map((l) => splitCsvLine(l, delimiter));

  let nameIdx = 0;
  let descIdx = -1;
  let catIdx = -1;
  let typeIdx = -1;
  let priceIdx = -1;
  let qtyIdx = -1;
  let urlIdx = -1;
  let pixIdx = -1;
  let imgIdx = -1;

  let startIndex = 0;

  // Check if first row is a header
  const headerRow = rows[0].map((c) => cleanStr(c));
  const recognizedHeaderKeywords = new Set([
    'nome',
    'name',
    'presente',
    'item',
    'produto',
    'title',
    'titulo',
    'descricao',
    'description',
    'detalhes',
    'obs',
    'categoria',
    'category',
    'tipo',
    'type',
    'preco',
    'price',
    'valor',
    'quantidade',
    'qtd',
    'cotas',
    'total',
    'link',
    'link_compra',
    'url',
    'loja',
    'pix',
    'chave_pix',
    'imagem',
    'imagem_url',
    'foto',
    'foto_url',
    'image',
  ]);

  const headerMatches = headerRow.filter((c) => recognizedHeaderKeywords.has(c));
  const hasHeader =
    headerMatches.length >= 2 ||
    (headerMatches.length === 1 && ['nome', 'name', 'presente', 'item'].includes(headerRow[0]));

  if (hasHeader) {
    startIndex = 1;
    headerRow.forEach((col, idx) => {
      if (col === 'reservadas' || col === 'disponiveis' || col === 'status') {
        return;
      }

      if (
        col === 'nome' ||
        col === 'name' ||
        col === 'presente' ||
        col === 'item' ||
        col === 'title' ||
        col === 'titulo' ||
        col === 'produto'
      ) {
        nameIdx = idx;
      } else if (
        col === 'descricao' ||
        col === 'description' ||
        col.includes('desc') ||
        col.includes('detalhe') ||
        col.includes('obs')
      ) {
        descIdx = idx;
      } else if (col === 'categoria' || col === 'category' || col.includes('categ')) {
        catIdx = idx;
      } else if (col === 'tipo' || col === 'type' || col.includes('tipo')) {
        typeIdx = idx;
      } else if (col === 'preco' || col === 'valor' || col === 'price' || col.includes('prec') || col.includes('valor')) {
        priceIdx = idx;
      } else if (
        col === 'quantidade' ||
        col === 'qtd' ||
        col === 'cotas' ||
        col === 'total' ||
        col.includes('quant') ||
        col.includes('qtd') ||
        col.includes('cota')
      ) {
        qtyIdx = idx;
      } else if (
        col === 'imagem' ||
        col === 'imagem_url' ||
        col === 'foto' ||
        col === 'foto_url' ||
        col.includes('imagem') ||
        col.includes('foto') ||
        col.includes('image') ||
        col.includes('img')
      ) {
        imgIdx = idx;
      } else if (
        col === 'link' ||
        col === 'link_compra' ||
        col === 'url' ||
        col === 'loja' ||
        col.includes('link') ||
        col.includes('url') ||
        col.includes('loja') ||
        col.includes('compra')
      ) {
        urlIdx = idx;
      } else if (col === 'pix' || col === 'chave_pix' || col.includes('pix')) {
        pixIdx = idx;
      }
    });
  } else {
    // Default column order assumption:
    // 0: nome, 1: descricao, 2: categoria, 3: tipo, 4: preco, 5: quantidade, 6: link_compra, 7: chave_pix, 8: imagem_url
    nameIdx = 0;
    descIdx = 1;
    catIdx = 2;
    typeIdx = 3;
    priceIdx = 4;
    qtyIdx = 5;
    urlIdx = 6;
    pixIdx = 7;
    imgIdx = 8;
  }

  const parsedGifts: ParsedCsvGift[] = [];
  const errors: string[] = [];

  for (let i = startIndex; i < rows.length; i++) {
    let row = rows[i];
    if (
      delimiter === ',' &&
      row.length > headerRow.length &&
      urlIdx >= 0 &&
      imgIdx > urlIdx
    ) {
      const trailingColumnCount = headerRow.length - urlIdx - 1;
      const urlEnd = row.length - trailingColumnCount;
      row = [
        ...row.slice(0, urlIdx),
        row.slice(urlIdx, urlEnd).join(','),
        ...row.slice(urlEnd),
      ];
    }
    const lineNumber = i + 1;
    const name = (nameIdx >= 0 && row[nameIdx] !== undefined ? row[nameIdx] : '').trim();

    if (!name) {
      errors.push(`Linha ${lineNumber}: nome do presente em branco`);
      continue;
    }

    const description = (descIdx >= 0 && row[descIdx] !== undefined ? row[descIdx] : '').trim();
    const category = parseCategory(catIdx >= 0 ? row[catIdx] : undefined);
    const purchaseUrl = normalizeUrl(urlIdx >= 0 ? row[urlIdx] : undefined);
    const rawPix = pixIdx >= 0 ? row[pixIdx]?.trim() : '';
    const pixKey = rawPix ? rawPix : undefined;
    const imageUrl = normalizeImageUrl(imgIdx >= 0 ? row[imgIdx] : undefined);
    const type = parseType(typeIdx >= 0 ? row[typeIdx] : undefined, purchaseUrl, pixKey);
    const price = parsePrice(priceIdx >= 0 ? row[priceIdx] : undefined);
    const totalQuantity = parseQuantity(qtyIdx >= 0 ? row[qtyIdx] : undefined);

    // Specific non-blocking warnings
    if ((type === 'pix' || type === 'shares') && !pixKey) {
      errors.push(`Linha ${lineNumber}: tipo Pix/cotas sem chave Pix`);
    }

    if (type === 'external' && !purchaseUrl) {
      errors.push(`Linha ${lineNumber}: tipo link sem URL de compra`);
    }

    parsedGifts.push({
      name,
      description,
      category,
      type,
      price,
      totalQuantity,
      purchaseUrl,
      pixKey,
      imageUrl,
      line: lineNumber,
    });
  }

  return {
    gifts: parsedGifts,
    totalRows: parsedGifts.length,
    errors,
  };
}

/**
 * Downloads a sample gifts CSV ready to be edited in Excel or Google Sheets
 */
export function downloadSampleGiftsCsv(): void {
  const content = [
    'Nome;Descricao;Categoria;Tipo;Preco;Quantidade;Link_Compra;Chave_Pix;Imagem_URL',
    'Jogo de Panelas Antiaderente;Conjunto 5 peças para a cozinha nova;cozinha;produto;389,90;1;;;',
    'Geladeira Frost Free (Cota);Ajude a mobiliar a cozinha nova!;cozinha;cotas;150,00;10;;11998765432;',
    'Pix para o Apê Novo;Contribuição em dinheiro com muito carinho;pix;pix;100,00;99;;alyne.custodio@dux-company.com;',
    'Cafeteira Nespresso Essenza Mini;Cafeteira expresso para o cantinho do café;cozinha;externo;450,00;1;https://www.amazon.com.br/dp/B0777B681K;;',
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'modelo_importacao_presentes_alyne.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
