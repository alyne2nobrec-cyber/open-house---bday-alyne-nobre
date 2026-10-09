import { GuestStatus } from '../types';

export interface ParsedCsvGuest {
  name: string;
  whatsapp?: string;
  maxCompanions: number;
  status: GuestStatus;
  notes?: string;
}

export interface CsvParseResult {
  guests: ParsedCsvGuest[];
  totalRows: number;
  errors: string[];
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
      insideQuotes = !insideQuotes;
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
 * Normalizes text to lowercase without accents
 */
function cleanStr(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function parseGuestsCsv(csvContent: string): CsvParseResult {
  const rawLines = csvContent.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (rawLines.length === 0) {
    return { guests: [], totalRows: 0, errors: ['O arquivo está vazio.'] };
  }

  const delimiter = detectDelimiter(csvContent);
  const rows = rawLines.map((l) => splitCsvLine(l, delimiter));

  let nameIdx = 0;
  let phoneIdx = -1;
  let maxCompIdx = -1;
  let statusIdx = -1;
  let notesIdx = -1;

  let startIndex = 0;

  // Check if first row is header
  const headerRow = rows[0].map((c) => cleanStr(c));
  const hasHeader = headerRow.some((h) =>
    ['nome', 'name', 'convidado', 'convidados', 'whatsapp', 'telefone', 'celular', 'acompanhante', 'limite', 'status'].some(
      (keyword) => h.includes(keyword)
    )
  );

  if (hasHeader) {
    startIndex = 1;
    headerRow.forEach((col, idx) => {
      if (col.includes('nome') || col.includes('name') || col.includes('convidado')) {
        nameIdx = idx;
      } else if (
        col.includes('whatsapp') ||
        col.includes('celular') ||
        col.includes('telefone') ||
        col.includes('phone') ||
        col.includes('contato')
      ) {
        phoneIdx = idx;
      } else if (
        col.includes('acompanhante') ||
        col.includes('limite') ||
        col.includes('max') ||
        col.includes('cota') ||
        col.includes('vagas')
      ) {
        maxCompIdx = idx;
      } else if (col.includes('status') || col.includes('presenca')) {
        statusIdx = idx;
      } else if (
        col.includes('obs') ||
        col.includes('nota') ||
        col.includes('recado') ||
        col.includes('observacao')
      ) {
        notesIdx = idx;
      }
    });
  } else {
    // Default column assumptions: Col 0 = Name, Col 1 = WhatsApp, Col 2 = MaxCompanions
    nameIdx = 0;
    phoneIdx = 1;
    maxCompIdx = 2;
  }

  const parsedGuests: ParsedCsvGuest[] = [];
  const errors: string[] = [];

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    const name = row[nameIdx]?.trim();
    if (!name || name.length < 2) continue;

    const rawPhone = phoneIdx >= 0 ? row[phoneIdx] : '';
    const phone = rawPhone ? rawPhone.replace(/[^\d+()-\s]/g, '').trim() : '';

    let maxCompanions = 1;
    if (maxCompIdx >= 0 && row[maxCompIdx] !== undefined) {
      const parsedNum = parseInt(row[maxCompIdx].replace(/[^\d]/g, ''), 10);
      if (!isNaN(parsedNum)) {
        maxCompanions = Math.max(0, Math.min(10, parsedNum));
      }
    }

    let status: GuestStatus = 'pending';
    if (statusIdx >= 0 && row[statusIdx]) {
      const cleanStatus = cleanStr(row[statusIdx]);
      if (cleanStatus.includes('confirm') || cleanStatus === 'sim') {
        status = 'confirmed';
      } else if (cleanStatus.includes('ausente') || cleanStatus.includes('recus') || cleanStatus === 'nao') {
        status = 'declined';
      }
    }

    const notes = notesIdx >= 0 ? row[notesIdx]?.trim() : '';

    parsedGuests.push({
      name,
      whatsapp: phone,
      maxCompanions,
      status,
      notes,
    });
  }

  return {
    guests: parsedGuests,
    totalRows: parsedGuests.length,
    errors,
  };
}

/**
 * Downloads a sample CSV ready to be edited in Excel or Google Sheets
 */
export function downloadSampleGuestsCsv(): void {
  const content = [
    'Nome;WhatsApp;Limite_Acompanhantes;Status;Observacao',
    'Camila Santos;11998765432;1;pendente;Amiga de infância',
    'Lucas Ferreira;11987654321;0;pendente;Primo (individual)',
    'Mariana Silva;11976543210;2;pendente;Colega com família',
    'Rodrigo Costa;11965432109;1;pendente;',
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'modelo_importacao_convidados_alyne.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
