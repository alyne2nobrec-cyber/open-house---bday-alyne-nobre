import { arrayRemove, arrayUnion, collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';

/**
 * Marcações de "mensagem enviada" por modelo de WhatsApp.
 * Fonte da verdade: Firestore (coleção whatsappSent, um documento por modelo, campo guestIds).
 * Assim celular e computador enxergam as mesmas marcações em tempo real.
 * O localStorage é só cache/fallback (offline ou Firebase não configurado).
 */
const SENT_COLLECTION = 'whatsappSent';
const CACHE_KEY = 'alyne_whatsapp_sent_by_template';
const LEGACY_KEY = 'alyne_whatsapp_sent_guests';
const MIGRATED_KEY = 'alyne_whatsapp_sent_migrated_v1';

export const SENT_TEMPLATE_KEYS = [
  'rsvp_invite',
  'rsvp_reminder',
  'event_details',
  'gift_registry',
  'gift_thanks',
  'custom',
] as const;

export type SentTemplateKey = (typeof SENT_TEMPLATE_KEYS)[number];
export type SentMap = Record<SentTemplateKey, string[]>;

export function emptySentMap(): SentMap {
  return {
    rsvp_invite: [],
    rsvp_reminder: [],
    event_details: [],
    gift_registry: [],
    gift_thanks: [],
    custom: [],
  };
}

export function readSentCache(): SentMap {
  const result = emptySentMap();
  if (typeof localStorage === 'undefined') return result;
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      for (const k of SENT_TEMPLATE_KEYS) {
        if (Array.isArray(parsed?.[k])) result[k] = parsed[k];
      }
      return result;
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    const legacyList = legacy ? JSON.parse(legacy) : [];
    if (Array.isArray(legacyList)) result.rsvp_invite = legacyList;
  } catch {
    /* ignora */
  }
  return result;
}

export function writeSentCache(map: SentMap): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(map));
  } catch {
    /* ignora */
  }
}

/** Escuta as marcações no Firestore. Na 1ª vez em cada aparelho, sobe o que só existia no navegador. */
export function subscribeWhatsappSent(
  callback: (map: SentMap) => void,
  onError?: (err: Error) => void
): () => void {
  if (!isFirebaseConfigured || !db) {
    callback(readSentCache());
    return () => {};
  }

  let migrationTried = false;

  return onSnapshot(
    collection(db, SENT_COLLECTION),
    (snapshot) => {
      const remote = emptySentMap();
      snapshot.docs.forEach((d) => {
        const ids = (d.data() as { guestIds?: unknown }).guestIds;
        if ((SENT_TEMPLATE_KEYS as readonly string[]).includes(d.id) && Array.isArray(ids)) {
          remote[d.id as SentTemplateKey] = ids.filter((x): x is string => typeof x === 'string');
        }
      });

      // Migração única por aparelho: envia para a nuvem marcações antigas que só estavam aqui.
      if (!migrationTried) {
        migrationTried = true;
        try {
          if (typeof localStorage !== 'undefined' && !localStorage.getItem(MIGRATED_KEY)) {
            const local = readSentCache();
            for (const k of SENT_TEMPLATE_KEYS) {
              const missing = local[k].filter((id) => !remote[k].includes(id));
              if (missing.length > 0) {
                remote[k] = [...remote[k], ...missing];
                void setDoc(
                  doc(db!, SENT_COLLECTION, k),
                  { guestIds: arrayUnion(...missing), updatedAt: new Date().toISOString() },
                  { merge: true }
                ).catch((e) => console.warn('Falha ao migrar marcações de envio:', e));
              }
            }
            localStorage.setItem(MIGRATED_KEY, '1');
          }
        } catch {
          /* ignora */
        }
      }

      writeSentCache(remote);
      callback(remote);
    },
    (err) => {
      console.warn('Erro ao ler marcações de envio (usando cache local):', err?.message || err);
      callback(readSentCache());
      onError?.(err as Error);
    }
  );
}

/** Marca/desmarca um convidado como "enviado" em um modelo (atômico: não sobrescreve outro aparelho). */
export async function setGuestSent(template: SentTemplateKey, guestId: string, sent: boolean): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  await setDoc(
    doc(db, SENT_COLLECTION, template),
    {
      guestIds: sent ? arrayUnion(guestId) : arrayRemove(guestId),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

/** Zera as marcações de um modelo (ou de todos, se nenhum for informado). */
export async function clearSent(template?: SentTemplateKey): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  const keys = template ? [template] : [...SENT_TEMPLATE_KEYS];
  await Promise.all(
    keys.map((k) =>
      setDoc(doc(db!, SENT_COLLECTION, k), { guestIds: [], updatedAt: new Date().toISOString() }, { merge: true })
    )
  );
}
