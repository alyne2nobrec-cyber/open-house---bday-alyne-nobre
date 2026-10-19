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

  // Se o cache estiver vazio, tenta recuperar também do servidor Express se disponível
  if (cached.length === 0 && typeof fetch !== 'undefined') {
    fetch('/api/gallery')
      .then((r) => r.json())
      .then((apiItems) => {
        if (Array.isArray(apiItems) && apiItems.length > 0) {
          const sorted = sortItems(apiItems);
          writeCache(sorted);
          callback(sorted);
        }
      })
      .catch(() => {});
  }

  if (!isFirebaseConfigured || !db) {
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
      console.warn('Erro ao ler a galeria do Firestore (usando fallback local):', err?.message || err);
      const isPermissionError =
        (err as any)?.code === 'permission-denied' ||
        String(err?.message || '').toLowerCase().includes('permission');

      // Garante entrega do cache local para a interface continuar exibindo as imagens
      const fallback = readCache(LOCAL_CACHE_KEY);
      if (fallback.length > 0) {
        callback(fallback);
      }

      if (!isPermissionError) {
        onError?.(err as Error);
      }
    }
  );

  return unsubscribe;
}

export async function addGalleryMediaItem(
  item: Omit<GalleryMediaItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = new Date().toISOString();
  let generatedId = `media_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  let docRef: any = null;
  if (isFirebaseConfigured && db) {
    try {
      docRef = doc(collection(db, GALLERY_COLLECTION));
      generatedId = docRef.id;
    } catch {
      // continua com generatedId pré-calculado
    }
  }

  const newItem: GalleryMediaItem = {
    ...item,
    id: generatedId,
    createdAt: now,
    updatedAt: now,
  };

  // 1. Sempre atualiza o cache local imediatamente para a foto aparecer sem atraso
  const current = readCache(LOCAL_CACHE_KEY);
  const updated = sortItems([...current, newItem]);
  writeCache(updated);

  // 2. Se a rota de API local do Express estiver disponível, salva em /api/gallery como backup
  try {
    if (typeof fetch !== 'undefined') {
      void fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      }).catch(() => {});
    }
  } catch {}

  // 3. Tenta persistir no Firestore
  if (isFirebaseConfigured && db) {
    try {
      const targetRef = docRef || doc(db, GALLERY_COLLECTION, generatedId);
      await setDoc(targetRef, clean(newItem));
    } catch (err: any) {
      console.warn(
        'Aviso ao gravar no Firestore (mídia salva com sucesso no Cloudinary e localmente):',
        err?.message || err
      );
      const isPermissionError =
        err?.code === 'permission-denied' ||
        String(err?.message || '').toLowerCase().includes('permission');
      if (!isPermissionError) {
        throw err;
      }
    }
  }

  return generatedId;
}

export async function updateGalleryMediaItem(
  id: string,
  updates: Partial<Pick<GalleryMediaItem, 'caption' | 'order' | 'thumbnailUrl'>>
): Promise<void> {
  // Atualiza cache local
  const current = readCache(LOCAL_CACHE_KEY);
  const updated = current.map((it) => (it.id === id ? { ...it, ...updates } : it));
  writeCache(updated);

  if (isFirebaseConfigured && db) {
    try {
      await updateDoc(
        doc(db, GALLERY_COLLECTION, id),
        clean({ ...updates, updatedAt: new Date().toISOString() })
      );
    } catch (err: any) {
      console.warn('Aviso ao atualizar no Firestore (mantido localmente):', err?.message || err);
      const isPermissionError =
        err?.code === 'permission-denied' ||
        String(err?.message || '').toLowerCase().includes('permission');
      if (!isPermissionError) {
        throw err;
      }
    }
  }
}

export async function deleteGalleryMediaItem(
  id: string,
  _mediaItem?: Pick<GalleryMediaItem, 'url' | 'thumbnailUrl'>
): Promise<void> {
  // Atualiza cache local
  const current = readCache(LOCAL_CACHE_KEY);
  const updated = current.filter((it) => it.id !== id);
  writeCache(updated);

  // Remove da rota de API local se disponível
  try {
    if (typeof fetch !== 'undefined') {
      void fetch(`/api/gallery/${id}`, { method: 'DELETE' }).catch(() => {});
    }
  } catch {}

  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, GALLERY_COLLECTION, id));
    } catch (err: any) {
      console.warn('Aviso ao excluir no Firestore (removido localmente):', err?.message || err);
      const isPermissionError =
        err?.code === 'permission-denied' ||
        String(err?.message || '').toLowerCase().includes('permission');
      if (!isPermissionError) {
        throw err;
      }
    }
  }
}

export async function reorderGalleryMediaItems(items: GalleryMediaItem[]): Promise<void> {
  // Atualiza cache local
  writeCache(items);

  // Sincroniza com a rota de API local se disponível
  try {
    if (typeof fetch !== 'undefined') {
      void fetch('/api/gallery/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      }).catch(() => {});
    }
  } catch {}

  if (isFirebaseConfigured && db) {
    const firestore = db;
    try {
      const batch = writeBatch(firestore);
      const now = new Date().toISOString();
      items.forEach((item, index) => {
        batch.update(doc(firestore, GALLERY_COLLECTION, item.id), { order: index, updatedAt: now });
      });
      await batch.commit();
    } catch (err: any) {
      console.warn('Aviso ao reordenar no Firestore (mantido localmente):', err?.message || err);
      const isPermissionError =
        err?.code === 'permission-denied' ||
        String(err?.message || '').toLowerCase().includes('permission');
      if (!isPermissionError) {
        throw err;
      }
    }
  }
}
