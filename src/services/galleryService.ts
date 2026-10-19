import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import { GalleryMediaItem } from '../types';

const GALLERY_COLLECTION = 'galleryMedia';
const LOCAL_CACHE_KEY = 'alyne_gallery_media_cache_v2';
const LEGACY_LOCAL_KEY = 'alyne_gallery_media_items_v1';

function sortItems(items: GalleryMediaItem[]): GalleryMediaItem[] {
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** Firestore rejeita `undefined`; remove campos indefinidos antes de gravar. */
function clean<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined) out[k] = v;
  });
  return out as T;
}

function readCache(key: string): GalleryMediaItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? sortItems(parsed) : [];
  } catch {
    return [];
  }
}

function writeCache(items: GalleryMediaItem[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(items));
  } catch {}
}

function requireDb() {
  if (!isFirebaseConfigured || !db) {
    throw new Error(
      'Firebase não configurado: não foi possível salvar a galeria para todos os convidados.'
    );
  }
  return db;
}

async function migrateLegacyItemsIfNeeded(): Promise<void> {
  if (!db || !auth?.currentUser) return;
  const legacy = [...readCache(LEGACY_LOCAL_KEY), ...readCache(LOCAL_CACHE_KEY)];
  const unique = new Map<string, GalleryMediaItem>();
  legacy.forEach((it) => {
    if (it?.id && it.url && !unique.has(it.id)) unique.set(it.id, it);
  });
  if (unique.size === 0) return;

  try {
    const batch = writeBatch(db);
    Array.from(unique.values()).forEach((item, idx) => {
      batch.set(
        doc(db!, GALLERY_COLLECTION, item.id),
        clean({ ...item, order: item.order ?? idx })
      );
    });
    await batch.commit();
    try {
      localStorage.removeItem(LEGACY_LOCAL_KEY);
    } catch {}
  } catch (err) {
    console.warn('Não foi possível migrar a galeria antiga para o Firestore:', err);
  }
}

export function subscribeGalleryMedia(
  callback: (items: GalleryMediaItem[]) => void,
  onError?: (err: Error) => void
): () => void {
  const cached = readCache(LOCAL_CACHE_KEY);
  if (cached.length > 0) callback(cached);

  if (!isFirebaseConfigured || !db) {
    onError?.(new Error('Firebase não configurado'));
    return () => {};
  }

  let migrationTried = false;

  const unsubscribe = onSnapshot(
    query(collection(db, GALLERY_COLLECTION)),
    (snapshot) => {
      const items = sortItems(
        snapshot.docs.map((d) => ({ ...(d.data() as Omit<GalleryMediaItem, 'id'>), id: d.id }))
      );
      writeCache(items);
      callback(items);

      if (items.length === 0 && !migrationTried) {
        migrationTried = true;
        void migrateLegacyItemsIfNeeded();
      }
    },
    (err) => {
      console.warn('Erro ao ler a galeria do Firestore:', err);
      onError?.(err as Error);
    }
  );

  return unsubscribe;
}

export async function addGalleryMediaItem(
  item: Omit<GalleryMediaItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const firestore = requireDb();
  const ref = doc(collection(firestore, GALLERY_COLLECTION));
  const now = new Date().toISOString();
  await setDoc(ref, clean({ ...item, createdAt: now, updatedAt: now }));
  return ref.id;
}

export async function updateGalleryMediaItem(
  id: string,
  updates: Partial<Pick<GalleryMediaItem, 'caption' | 'order' | 'thumbnailUrl'>>
): Promise<void> {
  const firestore = requireDb();
  await updateDoc(
    doc(firestore, GALLERY_COLLECTION, id),
    clean({ ...updates, updatedAt: new Date().toISOString() })
  );
}

export async function deleteGalleryMediaItem(
  id: string,
  _mediaItem?: Pick<GalleryMediaItem, 'url' | 'thumbnailUrl'>
): Promise<void> {
  const firestore = requireDb();
  await deleteDoc(doc(firestore, GALLERY_COLLECTION, id));
}

export async function reorderGalleryMediaItems(items: GalleryMediaItem[]): Promise<void> {
  const firestore = requireDb();
  const batch = writeBatch(firestore);
  const now = new Date().toISOString();
  items.forEach((item, index) => {
    batch.update(doc(firestore, GALLERY_COLLECTION, item.id), { order: index, updatedAt: now });
  });
  await batch.commit();
}
