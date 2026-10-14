import { GalleryMediaItem } from '../types';

const LOCAL_STORAGE_GALLERY_KEY = 'alyne_gallery_media_items_v1';
const GALLERY_EVENT_NAME = 'alyne:gallery-updated';

let localGalleryListeners: Array<(items: GalleryMediaItem[]) => void> = [];

/**
 * Gets cached gallery items from local storage.
 */
function getLocalGalleryItems(): GalleryMediaItem[] {
  if (typeof localStorage === 'undefined') return [];
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

/**
 * Saves gallery items to local storage and notifies active listeners.
 */
function saveLocalGalleryItems(items: GalleryMediaItem[]): void {
  const sorted = [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_GALLERY_KEY, JSON.stringify(sorted));
    } catch {}
  }

  // Notify listeners in the current process
  localGalleryListeners.forEach((fn) => {
    try {
      fn([...sorted]);
    } catch (e) {
      console.warn('Listener error in gallery update:', e);
    }
  });

  // Notify other components/tabs
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(GALLERY_EVENT_NAME, { detail: sorted }));
    } catch {}
  }
}

/**
 * Fetches the gallery items from the backend API and syncs to local state.
 */
async function fetchServerGalleryItems(): Promise<GalleryMediaItem[]> {
  try {
    const res = await fetch('/api/gallery', {
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
    if (res.ok) {
      const serverItems = await res.json();
      if (Array.isArray(serverItems)) {
        // If server has items, adopt them
        if (serverItems.length > 0) {
          saveLocalGalleryItems(serverItems);
          return serverItems;
        } else {
          // If server is empty but local has items (e.g. uploaded before server was up), sync them up
          const localItems = getLocalGalleryItems();
          if (localItems.length > 0) {
            for (const item of localItems) {
              try {
                await fetch('/api/gallery', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(item),
                });
              } catch {}
            }
          }
          return localItems;
        }
      }
    }
  } catch (err) {
    // Backend fetch failed (e.g., offline or dev mode); fall back gracefully to local storage
    console.warn('Note: Using local gallery storage (backend offline or loading):', err);
  }
  return getLocalGalleryItems();
}

/**
 * Reactive subscription to gallery media items.
 * Immediately returns local cached items, syncs with backend, and keeps all UI views in sync.
 */
export function subscribeGalleryMedia(
  callback: (items: GalleryMediaItem[]) => void,
  _onError?: (err: Error) => void
): () => void {
  // 1. Immediately emit cached items to avoid flash of empty content
  const initial = getLocalGalleryItems();
  callback(initial);

  // 2. Register listener
  localGalleryListeners.push(callback);

  // 3. Initial fetch from server
  fetchServerGalleryItems().then((items) => {
    callback(items);
  });

  // 4. Custom event listener for same-window component updates
  const handleCustomEvent = (e: Event) => {
    const custom = e as CustomEvent<GalleryMediaItem[]>;
    if (custom.detail && Array.isArray(custom.detail)) {
      callback(custom.detail);
    } else {
      callback(getLocalGalleryItems());
    }
  };

  // 5. Storage event for cross-tab synchronization
  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === LOCAL_STORAGE_GALLERY_KEY) {
      callback(getLocalGalleryItems());
    }
  };

  // 6. Polling interval to keep multiple devices in sync (every 25 seconds)
  let pollInterval: any = null;
  if (typeof window !== 'undefined') {
    window.addEventListener(GALLERY_EVENT_NAME, handleCustomEvent);
    window.addEventListener('storage', handleStorageEvent);

    pollInterval = setInterval(() => {
      fetchServerGalleryItems().then((items) => {
        callback(items);
      });
    }, 25000);
  }

  // Cleanup function
  return () => {
    localGalleryListeners = localGalleryListeners.filter((fn) => fn !== callback);
    if (typeof window !== 'undefined') {
      window.removeEventListener(GALLERY_EVENT_NAME, handleCustomEvent);
      window.removeEventListener('storage', handleStorageEvent);
      if (pollInterval) clearInterval(pollInterval);
    }
  };
}

/**
 * Adds a new photo or video to the gallery.
 * Saves to local cache and server API, hosted directly on Cloudinary.
 */
export async function addGalleryMediaItem(
  item: Omit<GalleryMediaItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const localId = `media_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const newItem: GalleryMediaItem = {
    ...item,
    id: localId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Immediate local update
  const current = getLocalGalleryItems();
  current.push(newItem);
  saveLocalGalleryItems(current);

  // Background server sync
  try {
    const res = await fetch('/api/gallery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem),
    });

    if (res.ok) {
      const serverCreated = await res.json();
      if (serverCreated && serverCreated.id) {
        // Update local item with confirmed server id if different
        const updated = getLocalGalleryItems().map((it) =>
          it.id === localId ? { ...it, ...serverCreated } : it
        );
        saveLocalGalleryItems(updated);
        return serverCreated.id;
      }
    }
  } catch (err) {
    console.warn('Server sync warning (saved locally in browser):', err);
  }

  return localId;
}

/**
 * Updates an existing gallery item's caption, order, or thumbnail.
 */
export async function updateGalleryMediaItem(
  id: string,
  updates: Partial<Pick<GalleryMediaItem, 'caption' | 'order' | 'thumbnailUrl'>>
): Promise<void> {
  const current = getLocalGalleryItems();
  const idx = current.findIndex((item) => item.id === id);
  if (idx !== -1) {
    current[idx] = { ...current[idx], ...updates, updatedAt: new Date().toISOString() };
    saveLocalGalleryItems(current);
  }

  try {
    await fetch(`/api/gallery/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  } catch (err) {
    console.warn('Server update warning:', err);
  }
}

/**
 * Deletes a media item from the gallery.
 */
export async function deleteGalleryMediaItem(
  id: string,
  _mediaItem?: Pick<GalleryMediaItem, 'url' | 'thumbnailUrl'>
): Promise<void> {
  const current = getLocalGalleryItems();
  const filtered = current.filter((item) => item.id !== id);
  saveLocalGalleryItems(filtered);

  try {
    await fetch(`/api/gallery/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('Server delete warning:', err);
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

  saveLocalGalleryItems(updatedItems);

  try {
    await fetch('/api/gallery/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: updatedItems }),
    });
  } catch (err) {
    console.warn('Server reorder warning:', err);
  }
}
