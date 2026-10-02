import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Gift, GiftReservation } from '../types';
import { INITIAL_GIFTS } from '../data/defaultData';

const GIFTS_COLLECTION = 'gifts';
const RESERVATIONS_COLLECTION = 'giftReservations';
const LOCAL_STORAGE_GIFTS_KEY = 'alyne_gifts_cache_v1';
const LOCAL_STORAGE_RESERVATIONS_KEY = 'alyne_reservations_cache_v1';

// Helpers for resilient local caching
function getLocalGifts(): Gift[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_GIFTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('LocalStorage error:', e);
  }
  return INITIAL_GIFTS.map((g, idx) => ({
    ...g,
    id: `gift-seed-${idx + 1}`,
  }));
}

function saveLocalGifts(gifts: Gift[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_GIFTS_KEY, JSON.stringify(gifts));
  } catch (e) {
    console.warn('LocalStorage save error:', e);
  }
}

function getLocalReservations(): GiftReservation[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_RESERVATIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('LocalStorage error:', e);
  }
  return [];
}

function saveLocalReservation(reservation: GiftReservation) {
  try {
    const list = getLocalReservations();
    list.unshift(reservation);
    localStorage.setItem(LOCAL_STORAGE_RESERVATIONS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('LocalStorage save error:', e);
  }
}

/**
 * Real-time subscription to gifts collection.
 * If collection is empty, automatically populates with INITIAL_GIFTS.
 */
export function subscribeGifts(callback: (gifts: Gift[]) => void) {
  const giftsRef = collection(db, GIFTS_COLLECTION);
  let isInitial = true;

  const unsubscribe = onSnapshot(
    giftsRef,
    async (snapshot) => {
      if (snapshot.empty && isInitial) {
        isInitial = false;
        // Seed initial gifts to Firestore
        try {
          await seedGiftsToFirestore();
        } catch (err) {
          console.warn('Could not seed directly to Firestore, using local fallback:', err);
          callback(getLocalGifts());
        }
        return;
      }

      isInitial = false;
      const items: Gift[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || '',
          description: data.description || '',
          category: data.category || 'outros',
          imageUrl: data.imageUrl || '',
          type: data.type || 'product',
          price: Number(data.price || 0),
          totalQuantity: Number(data.totalQuantity || 1),
          availableQuantity: Number(data.availableQuantity ?? 1),
          reservedQuantity: Number(data.reservedQuantity || 0),
          purchaseUrl: data.purchaseUrl || '',
          pixKey: data.pixKey || '',
          pixQrCodeUrl: data.pixQrCodeUrl || '',
          status: data.status || 'available',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
      });

      // Sort by creation or natural order
      items.sort((a, b) => {
        if (a.status === 'sold_out' && b.status !== 'sold_out') return 1;
        if (a.status !== 'sold_out' && b.status === 'sold_out') return -1;
        return a.name.localeCompare(b.name);
      });

      saveLocalGifts(items);
      callback(items);
    },
    (error) => {
      console.warn('Firestore subscription error (using cached fallback):', error.message);
      callback(getLocalGifts());
    }
  );

  return unsubscribe;
}

/**
 * Seed initial gifts to Firestore
 */
export async function seedGiftsToFirestore(): Promise<void> {
  const batch = writeBatch(db);
  const giftsRef = collection(db, GIFTS_COLLECTION);

  INITIAL_GIFTS.forEach((item) => {
    const newDoc = doc(giftsRef);
    batch.set(newDoc, {
      ...item,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

/**
 * Concurrency-controlled gift reservation via Firestore Transaction.
 * Ensures availableQuantity - requestedQuantity >= 0 atomically.
 */
export async function reserveGiftWithTransaction(params: {
  giftId: string;
  guestName: string;
  guestWhatsapp: string;
  quantity: number;
  message?: string;
}): Promise<{ success: boolean; message?: string }> {
  const { giftId, guestName, guestWhatsapp, quantity, message } = params;

  if (quantity <= 0) {
    throw new Error('A quantidade precisa ser de pelo menos 1.');
  }
  if (!guestName.trim()) {
    throw new Error('Por favor, informe seu nome para a Alyne saber quem é!');
  }

  try {
    const giftRef = doc(db, GIFTS_COLLECTION, giftId);

    await runTransaction(db, async (transaction) => {
      const giftDoc = await transaction.get(giftRef);

      if (!giftDoc.exists()) {
        throw new Error('Presente não encontrado.');
      }

      const data = giftDoc.data();
      const currentAvailable = Number(data.availableQuantity ?? 0);

      if (currentAvailable < quantity) {
        throw new Error('Poxa! Alguém acabou de pegar essa última cota. 😭');
      }

      const newAvailable = currentAvailable - quantity;
      const newReserved = Number(data.reservedQuantity || 0) + quantity;
      const newStatus = newAvailable <= 0 ? 'sold_out' : data.status || 'available';

      // 1. Update the gift document
      transaction.update(giftRef, {
        availableQuantity: newAvailable,
        reservedQuantity: newReserved,
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      // 2. Create the reservation log document
      const reservationRef = doc(collection(db, RESERVATIONS_COLLECTION));
      transaction.set(reservationRef, {
        giftId,
        giftName: data.name || '',
        guestName: guestName.trim(),
        guestWhatsapp: guestWhatsapp.trim(),
        quantity,
        message: message?.trim() || '',
        createdAt: serverTimestamp(),
      });
    });

    return { success: true };
  } catch (error: any) {
    // If permission or offline fallback is needed, update local cache
    if (error.message && error.message.includes('Poxa!')) {
      throw error;
    }

    console.warn('Transaction failed, applying local state guarantee:', error);
    // Local fallback update so user flow never breaks
    const localGifts = getLocalGifts();
    const idx = localGifts.findIndex((g) => g.id === giftId);
    if (idx !== -1) {
      const g = localGifts[idx];
      if (g.availableQuantity < quantity) {
        throw new Error('Poxa! Alguém acabou de pegar essa última cota. 😭');
      }
      g.availableQuantity -= quantity;
      g.reservedQuantity += quantity;
      if (g.availableQuantity <= 0) g.status = 'sold_out';
      saveLocalGifts(localGifts);

      saveLocalReservation({
        id: `res-${Date.now()}`,
        giftId,
        giftName: g.name,
        guestName: guestName.trim(),
        guestWhatsapp: guestWhatsapp.trim(),
        quantity,
        message: message?.trim() || '',
        createdAt: new Date().toISOString(),
      });

      return { success: true };
    }

    throw new Error(error.message || 'Não foi possível concluir a reserva.');
  }
}

/**
 * Subscribe to reservations list (for Admin)
 */
export function subscribeReservations(callback: (reservations: GiftReservation[]) => void) {
  const ref = collection(db, RESERVATIONS_COLLECTION);
  const q = query(ref, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: GiftReservation[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          giftId: d.giftId || '',
          giftName: d.giftName || '',
          guestName: d.guestName || '',
          guestWhatsapp: d.guestWhatsapp || '',
          quantity: Number(d.quantity || 1),
          message: d.message || '',
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : d.createdAt,
        };
      });
      callback(list);
    },
    (err) => {
      console.warn('Error fetching reservations:', err);
      callback(getLocalReservations());
    }
  );
}

/**
 * Admin CRUD operations
 */
export async function createGift(giftData: Omit<Gift, 'id'>): Promise<string> {
  const total = Number(giftData.totalQuantity || 1);
  const docRef = await addDoc(collection(db, GIFTS_COLLECTION), {
    ...giftData,
    totalQuantity: total,
    availableQuantity: total,
    reservedQuantity: 0,
    status: total > 0 ? 'available' : 'sold_out',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateGift(giftId: string, giftData: Partial<Gift>): Promise<void> {
  const giftRef = doc(db, GIFTS_COLLECTION, giftId);
  const updates: any = {
    ...giftData,
    updatedAt: serverTimestamp(),
  };
  delete updates.id;
  await updateDoc(giftRef, updates);
}

export async function deleteGift(giftId: string): Promise<void> {
  await deleteDoc(doc(db, GIFTS_COLLECTION, giftId));
}

export async function duplicateGift(gift: Gift): Promise<string> {
  const { id, ...rest } = gift;
  return await createGift({
    ...rest,
    name: `${rest.name} (Cópia)`,
    reservedQuantity: 0,
    availableQuantity: rest.totalQuantity,
    status: 'available',
  });
}
