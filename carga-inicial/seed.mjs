// Carga inicial de presentes e convidados no Firestore.
// Uso:
//   node seed.mjs --dry-run                       (só valida os arquivos, não grava nada)
//   node seed.mjs --service-account chave.json    (grava presentes e convidados)
//   node seed.mjs --service-account chave.json --only gifts|guests
// É idempotente: ids são gerados pelo nome; quem já existe é PULADO (nunca sobrescreve
// nem apaga nada, então reservas e confirmações já feitas ficam intactas).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const dry = flag('--dry-run');
const only = val('--only');
const saPath = val('--service-account');

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

const CATS = ['casa', 'cozinha', 'sala', 'quarto', 'banheiro', 'pix', 'outros'];
const TYPES = ['product', 'pix', 'shares', 'external', 'other'];
const errors = [];

// ---------- presentes ----------
function loadGifts() {
  const list = JSON.parse(readFileSync(join(here, 'presentes.json'), 'utf8'));
  const seen = new Set();
  return list.map((g, i) => {
    const where = `presentes.json item ${i + 1} (${g.name || 'sem nome'})`;
    if (!g.name?.trim()) errors.push(`${where}: nome vazio`);
    if (!CATS.includes(g.category)) errors.push(`${where}: categoria inválida "${g.category}"`);
    if (!TYPES.includes(g.type)) errors.push(`${where}: tipo inválido "${g.type}"`);
    if (!(Number(g.price) >= 0)) errors.push(`${where}: preço inválido`);
    if (!(Number.isInteger(g.totalQuantity) && g.totalQuantity >= 1)) errors.push(`${where}: totalQuantity deve ser inteiro >= 1`);
    const id = 'gift-' + slug(g.name || String(i));
    if (seen.has(id)) errors.push(`${where}: nome duplicado`);
    seen.add(id);
    return {
      id,
      data: {
        name: g.name.trim(), description: g.description || '', category: g.category,
        imageUrl: g.imageUrl || '', type: g.type, price: Number(g.price),
        totalQuantity: g.totalQuantity, availableQuantity: g.totalQuantity, reservedQuantity: 0,
        purchaseUrl: g.purchaseUrl || '', pixKey: g.pixKey || '', pixQrCodeUrl: g.pixQrCodeUrl || '',
        status: 'available',
      },
    };
  });
}

// ---------- convidados ----------
function parseCsvLine(line, d) {
  const out = []; let cur = ''; let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === d && !q) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}
function loadGuests() {
  const raw = readFileSync(join(here, 'convidados.csv'), 'utf8').replace(/^﻿/, '');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const d = lines[0].includes(';') ? ';' : ',';
  const header = parseCsvLine(lines[0], d).map((h) => slug(h));
  const col = (k) => header.findIndex((h) => h.includes(k));
  const iName = col('nome'), iPhone = col('whatsapp'), iMax = col('limite'), iStatus = col('status'), iNotes = col('obs');
  if (iName < 0) errors.push('convidados.csv: coluna "Nome" não encontrada');
  const seen = new Set();
  const out = [];
  lines.slice(1).forEach((line, n) => {
    const r = parseCsvLine(line, d);
    const name = (r[iName] || '').trim();
    const where = `convidados.csv linha ${n + 2} (${name})`;
    if (!name) return;
    if (/^exemplo\b/i.test(name)) { errors.push(`${where}: ainda é linha de EXEMPLO — apague ou troque pelo convidado real`); return; }
    const phone = (r[iPhone] || '').replace(/\D/g, '');
    if (phone && phone.length < 8) errors.push(`${where}: WhatsApp curto demais`);
    const max = parseInt((r[iMax] || '1').replace(/\D/g, ''), 10);
    const maxCompanions = Number.isNaN(max) ? 1 : Math.max(0, Math.min(9, max));
    const cleanPhone = phone.startsWith('55') && phone.length > 11 ? phone.slice(2) : phone;
    const phoneId = cleanPhone.length >= 8 && !/^0+$/.test(cleanPhone) && !/^(\d)\1+$/.test(cleanPhone) ? cleanPhone.slice(-11) : null;
    const id = phoneId || ('guest-' + slug(name));
    if (seen.has(id)) errors.push(`${where}: nome duplicado na planilha`);
    seen.add(id);
    out.push({ id, data: {
      name, whatsapp: phone, maxCompanions, attendees: 0, companions: [], status: 'pending',
      notes: (r[iNotes] || '').trim(),
    } });
  });
  return out;
}

const gifts = only === 'guests' ? [] : loadGifts();
const guests = only === 'gifts' ? [] : loadGuests();
console.log(`Presentes lidos: ${gifts.length} | Convidados lidos: ${guests.length}`);
if (errors.length) { console.error('\nProblemas encontrados:\n- ' + errors.join('\n- ')); process.exit(1); }
if (dry) { console.log('Dry-run OK: arquivos válidos, nada foi gravado.'); process.exit(0); }
if (!saPath) { console.error('Informe --service-account chave.json (ou use --dry-run).'); process.exit(1); }

const { initializeApp, cert } = await import('firebase-admin/app');
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) });
const db = getFirestore();

async function load(col, items) {
  let created = 0, skipped = 0;
  for (const { id, data } of items) {
    const ref = db.collection(col).doc(id);
    if ((await ref.get()).exists) { skipped++; continue; }
    await ref.create({ ...data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    created++;
  }
  console.log(`${col}: ${created} criados, ${skipped} já existiam (pulados).`);
}
await load('gifts', gifts);
await load('guests', guests);
console.log('Concluído.');
