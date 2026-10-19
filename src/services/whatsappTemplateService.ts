import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';

const TEMPLATES_COLLECTION = 'whatsappTemplates';
const CACHE_KEY = 'alyne_whatsapp_templates_cache_v1';

export const WHATSAPP_TEMPLATE_KEYS = [
  'rsvp_invite',
  'rsvp_reminder',
  'event_details',
  'gift_registry',
  'gift_thanks',
  'custom',
] as const;

/** Somente modelos PERSONALIZADOS: { chave: texto }. Modelo ausente = usa o padrão do código. */
export type SavedWhatsappTemplates = Record<string, string>;

function readCache(): SavedWhatsappTemplates {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeCache(saved: SavedWhatsappTemplates): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(saved));
  } catch {}
}

function requireDb() {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase não configurado: não foi possível salvar o modelo.');
  }
  return db;
}

export function subscribeWhatsappTemplates(
  callback: (saved: SavedWhatsappTemplates) => void,
  onError?: (err: Error) => void
): () => void {
  const cached = readCache();
  if (Object.keys(cached).length > 0) callback(cached);

  if (!isFirebaseConfigured || !db) {
    onError?.(new Error('Firebase não configurado'));
    return () => {};
  }

  return onSnapshot(
    collection(db, TEMPLATES_COLLECTION),
    (snapshot) => {
      const saved: SavedWhatsappTemplates = {};
      snapshot.docs.forEach((d) => {
        const text = (d.data() as { text?: unknown }).text;
        if ((WHATSAPP_TEMPLATE_KEYS as readonly string[]).includes(d.id) && typeof text === 'string' && text.length > 0) {
          saved[d.id] = text;
        }
      });
      writeCache(saved);
      callback(saved);
    },
    (err) => {
      console.warn('Erro ao ler modelos de WhatsApp:', err);
      onError?.(err as Error);
    }
  );
}

export async function saveWhatsappTemplate(key: string, text: string): Promise<void> {
  const firestore = requireDb();
  await setDoc(doc(firestore, TEMPLATES_COLLECTION, key), {
    text,
    updatedAt: new Date().toISOString(),
  });
}

export async function resetWhatsappTemplate(key: string): Promise<void> {
  const firestore = requireDb();
  await deleteDoc(doc(firestore, TEMPLATES_COLLECTION, key));
}
