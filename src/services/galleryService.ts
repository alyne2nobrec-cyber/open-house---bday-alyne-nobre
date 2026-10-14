import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { GalleryMediaItem } from '../types';

const GALLERY_COLLECTION = 'galleryMedia';
const LOCAL_STORAGE_GALLERY_KEY = 'alyne_gallery_media_items_v1';

let localGalleryListeners: Array<(items: GalleryMediaItem[]) => void> = [];

function getLocalGalleryItems(): GalleryMediaItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_GALLERY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
  } catch {}
  return [];
}

function saveLocalGalleryItems(items: GalleryMediaItem[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_GALLERY_KEY, JSON.stringify(items));
    localGalleryListeners.forEach((fn) => fn([...items]));
  } catch {}
}

/**
 * Real-time subscription to gallery media items ordered by display order.
 */
export function subscribeGalleryMedia(
  callback: (items: GalleryMediaItem[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!db) {
    const initial = getLocalGalleryItems();
    callback(initial);
    localGalleryListeners.push(callback);
    return () => {
      localGalleryListeners = localGalleryListeners.filter((fn) => fn !== callback);
    };
  }

  const collRef = collection(db, GALLERY_COLLECTION);
  const q = query(collRef, orderBy('order', 'asc'));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const items: GalleryMediaItem[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          type: (data.type === 'video' ? 'video' : 'image') as 'image' | 'video',
          url: data.url || '',
          thumbnailUrl: data.thumbnailUrl || undefined,
          caption: data.caption || '',
          order: typeof data.order === 'number' ? data.order : 0,
          fileName: data.fileName || undefined,
          fileSize: data.fileSize || undefined,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
      });

      // Synchronize to localStorage backup
      try {
        localStorage.setItem(LOCAL_STORAGE_GALLERY_KEY, JSON.stringify(items));
      } catch {}

      callback(items);
    },
    (error) => {
      console.warn('Gallery query with orderBy failed, retrying simple snapshot:', error);
      // Fallback: try querying without orderBy if composite index or permission issue happens
      const fallbackUnsub = onSnapshot(
        collRef,
        (snapshot) => {
          const items: GalleryMediaItem[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              type: (data.type === 'video' ? 'video' : 'image') as 'image' | 'video',
              url: data.url || '',
              thumbnailUrl: data.thumbnailUrl || undefined,
              caption: data.caption || '',
              order: typeof data.order === 'number' ? data.order : 0,
              fileName: data.fileName || undefined,
              fileSize: data.fileSize || undefined,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            };
          });
          items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          callback(items);
        },
        (fallbackError) => {
          console.error('Error subscribing to galleryMedia:', fallbackError);
          const cached = getLocalGalleryItems();
          callback(cached);
          if (onError) onError(fallbackError);
        }
      );
      return fallbackUnsub;
    }
  );

  return unsubscribe;
}

/**
 * Adds a new photo or video to the gallery.
 */
export async function addGalleryMediaItem(
  item: Omit<GalleryMediaItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  if (!db) {
    const id = `local-gallery-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const newItem: GalleryMediaItem = {
      ...item,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const current = getLocalGalleryItems();
    current.push(newItem);
    saveLocalGalleryItems(current);
    return id;
  }

  const collRef = collection(db, GALLERY_COLLECTION);
  const docRef = await addDoc(collRef, {
    type: item.type,
    url: item.url,
    thumbnailUrl: item.thumbnailUrl || null,
    caption: item.caption || '',
    order: item.order,
    fileName: item.fileName || null,
    fileSize: item.fileSize || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

/**
 * Updates an existing gallery item's caption or other fields.
 */
export async function updateGalleryMediaItem(
  id: string,
  updates: Partial<Pick<GalleryMediaItem, 'caption' | 'order' | 'thumbnailUrl'>>
): Promise<void> {
  if (!db) {
    const current = getLocalGalleryItems();
    const idx = current.findIndex((item) => item.id === id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...updates, updatedAt: new Date().toISOString() };
      saveLocalGalleryItems(current);
    }
    return;
  }

  const docRef = doc(db, GALLERY_COLLECTION, id);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Deletes a media item from Firestore and attempts removal from Storage.
 */
export async function deleteGalleryMediaItem(
  id: string,
  mediaItem?: Pick<GalleryMediaItem, 'url' | 'thumbnailUrl'>
): Promise<void> {
  if (db) {
    const docRef = doc(db, GALLERY_COLLECTION, id);
    await deleteDoc(docRef);
  }

  // Also remove from local cache
  const current = getLocalGalleryItems();
  const filtered = current.filter((item) => item.id !== id);
  saveLocalGalleryItems(filtered);

  // Try cleaning up storage file if it belongs to Firebase Storage
  if (storage && mediaItem?.url && mediaItem.url.includes('firebasestorage.googleapis.com')) {
    try {
      const storageRef = ref(storage, mediaItem.url);
      await deleteObject(storageRef);
    } catch (err) {
      console.warn('Storage file deletion ignored/skipped:', err);
    }

    if (mediaItem.thumbnailUrl && mediaItem.thumbnailUrl.includes('firebasestorage.googleapis.com')) {
      try {
        const thumbRef = ref(storage, mediaItem.thumbnailUrl);
        await deleteObject(thumbRef);
      } catch (err) {
        console.warn('Storage thumb deletion ignored/skipped:', err);
      }
    }
  }
}

/**
 * Reorders gallery items in batch.
 */
export async function reorderGalleryMediaItems(items: GalleryMediaItem[]): Promise<void> {
  const updatedItems = items.map((item, index) => ({
    ...item,
    order: index,
  }));

  const firestoreDb = db;
  if (!firestoreDb) {
    saveLocalGalleryItems(updatedItems);
    return;
  }

  const batch = writeBatch(firestoreDb);
  updatedItems.forEach((item) => {
    const docRef = doc(firestoreDb, GALLERY_COLLECTION, item.id);
    batch.update(docRef, {
      order: item.order,
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}
