/**
 * Safe CSV export utility:
 * - Uses Blob + URL.createObjectURL to prevent truncation by special characters like '#'
 * - Includes UTF-8 BOM (\uFEFF) for seamless compatibility with Microsoft Excel
 * - Sanitizes against CSV formula injection (=, +, -, @)
 */

function sanitizeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str = String(value).trim();

  // Prevent spreadsheet formula injection attacks
  if (/^[=+@-]/i.test(str)) {
    str = `'${str}`;
  }

  // Quote if contains semicolons, quotes, newlines or commas
  if (str.includes('"') || str.includes(';') || str.includes('\n') || str.includes('\r') || str.includes(',')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export function downloadCsvFile(filename: string, headers: string[], rows: (string | number | undefined | null)[][]): void {
  const sanitizedHeaders = headers.map(sanitizeCsvField).join(';');
  const sanitizedRows = rows.map((row) => row.map(sanitizeCsvField).join(';'));
  const content = '\uFEFF' + [sanitizedHeaders, ...sanitizedRows].join('\r\n');

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
