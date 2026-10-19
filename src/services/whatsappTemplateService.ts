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

export function subscribeWhatsappTemplates(
  callback: (saved: SavedWhatsappTemplates) => void,
  onError?: (err: Error) => void
): () => void {
  const cached = readCache();
  if (Object.keys(cached).length > 0) callback(cached);

  if (!isFirebaseConfigured || !db) {
    return () => {};
  }

  return onSnapshot(
    collection(db, TEMPLATES_COLLECTION),
    (snapshot) => {
      const saved: SavedWhatsappTemplates = {};
      snapshot.docs.forEach((d) => {
        const text = (d.data() as { text?: unknown }).text;
        if (
          (WHATSAPP_TEMPLATE_KEYS as readonly string[]).includes(d.id) &&
          typeof text === 'string' &&
          text.length > 0
        ) {
          saved[d.id] = text;
        }
      });
      // Mescla com cache local para não perder edições locais se o Firestore estiver vazio/sem permissão
      const currentCache = readCache();
      const merged = { ...currentCache, ...saved };
      writeCache(merged);
      callback(merged);
    },
    (err) => {
      console.warn('Aviso ao ler modelos de WhatsApp do Firestore (usando cache local):', err?.message || err);
      const currentCache = readCache();
      if (Object.keys(currentCache).length > 0) {
        callback(currentCache);
      }
      const isPermissionError =
        (err as any)?.code === 'permission-denied' ||
        String(err?.message || '').toLowerCase().includes('permission');
      if (!isPermissionError) {
        onError?.(err as Error);
      }
    }
  );
}

export async function saveWhatsappTemplate(key: string, text: string): Promise<void> {
  // 1. Sempre salva imediatamente no cache local para persistência instantânea no navegador
  const cached = readCache();
  cached[key] = text;
  writeCache(cached);

  // 2. Se o Firestore estiver configurado, tenta sincronizar na nuvem
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, TEMPLATES_COLLECTION, key), {
        text,
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.warn('Aviso ao sincronizar modelo no Firestore (mantido com sucesso no cache local):', err?.message || err);
      const isPermissionError =
        err?.code === 'permission-denied' ||
        String(err?.message || '').toLowerCase().includes('permission');
      if (!isPermissionError) {
        throw err;
      }
    }
  }
}

export async function resetWhatsappTemplate(key: string): Promise<void> {
  // 1. Remove imediatamente do cache local
  const cached = readCache();
  delete cached[key];
  writeCache(cached);

  // 2. Se o Firestore estiver configurado, tenta deletar na nuvem
  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, TEMPLATES_COLLECTION, key));
    } catch (err: any) {
      console.warn('Aviso ao resetar modelo no Firestore (removido do cache local):', err?.message || err);
      const isPermissionError =
        err?.code === 'permission-denied' ||
        String(err?.message || '').toLowerCase().includes('permission');
      if (!isPermissionError) {
        throw err;
      }
    }
  }
}
