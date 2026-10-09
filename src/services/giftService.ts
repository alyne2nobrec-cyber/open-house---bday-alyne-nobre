import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { Gift, GiftReservation } from '../types';
import { INITIAL_GIFTS, INITIAL_RESERVATIONS } from '../data/defaultData';

const GIFTS_COLLECTION = 'gifts';
const RESERVATIONS_COLLECTION = 'giftReservations';

const LOCAL_CUSTOM_GIFTS_KEY = 'alyne_custom_gifts_v2';
const LOCAL_GIFT_OVERRIDES_KEY = 'alyne_gift_overrides_v2';
const LOCAL_DELETED_GIFTS_KEY = 'alyne_deleted_gifts_v2';
const LOCAL_RESERVATIONS_KEY = 'alyne_reservations_cache_v2';

let localGiftListeners: Array<(gifts: Gift[]) => void> = [];
let localReservationListeners: Array<(reservations: GiftReservation[]) => void> = [];

export function getLocalStoredReservations(): GiftReservation[] {
  try {
    const raw = localStorage.getItem(LOCAL_RESERVATIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading local reservations:', e);
  }

  // Seed default reservations
  const seeded = [...INITIAL_RESERVATIONS];
  try {
    localStorage.setItem(LOCAL_RESERVATIONS_KEY, JSON.stringify(seeded));
  } catch {}
  return seeded;
}

function saveLocalReservations(list: GiftReservation[]) {
  try {
    localStorage.setItem(LOCAL_RESERVATIONS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Error saving local reservations:', e);
  }
}

function notifyReservationListeners() {
  const list = getLocalStoredReservations();
  localReservationListeners.forEach((fn) => fn(list));
}

function getLocalCustomGifts(): Gift[] {
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOM_GIFTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getLocalGiftOverrides(): Record<string, Partial<Gift>> {
  try {
    const raw = localStorage.getItem(LOCAL_GIFT_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getLocalDeletedGifts(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_DELETED_GIFTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getLocalMergedGifts(): Gift[] {
  const custom = getLocalCustomGifts();
  const overrides = getLocalGiftOverrides();
  const deleted = new Set(getLocalDeletedGifts());

  const reservations = getLocalStoredReservations();
  const reservedCounts: Record<string, number> = {};
  for (const res of reservations) {
    reservedCounts[res.giftId] = (reservedCounts[res.giftId] || 0) + (res.quantity || 1);
  }

  const baseGifts: Gift[] = INITIAL_GIFTS.map((g, idx) => ({
    ...g,
    id: `gift-seed-${idx + 1}`,
  }));

  const all = [...custom, ...baseGifts]
    .filter((g) => !deleted.has(g.id))
    .map((g) => {
      const override = overrides[g.id] || {};
      const merged = { ...g, ...override };
      const reserved =
        reservedCounts[merged.id] !== undefined
          ? reservedCounts[merged.id]
          : Number(merged.reservedQuantity || 0);
      const total = Number(merged.totalQuantity || 1);
      const available = Math.max(0, total - reserved);
      const status =
        merged.status === 'unavailable'
          ? 'unavailable'
          : available <= 0
          ? 'sold_out'
          : 'available';
      return {
        ...merged,
        reservedQuantity: reserved,
        availableQuantity: available,
        status: status as Gift['status'],
      };
    });

  return all;
}

function notifyGiftListeners() {
  const merged = getLocalMergedGifts();
  localGiftListeners.forEach((fn) => fn(merged));
}

const isAdminUser = () => {
  return typeof window !== 'undefined' && !!localStorage.getItem('alyne_admin_logged_in');
};

export function subscribeGifts(callback: (gifts: Gift[]) => void) {
  if (!isFirebaseConfigured) {
    localGiftListeners.push(callback);
    callback(getLocalMergedGifts());
    return () => {
      localGiftListeners = localGiftListeners.filter((fn) => fn !== callback);
    };
  }

  const giftsRef = collection(db, GIFTS_COLLECTION);
  let shouldSeed = true;

  const unsubscribe = onSnapshot(
    giftsRef,
    async (snapshot) => {
      if (snapshot.empty && shouldSeed) {
        shouldSeed = false;
        if (isAdminUser()) {
          try {
            await seedGiftsToFirestore();
            return;
          } catch (err) {
            console.warn('Could not seed gifts to Firestore:', err);
          }
        }
        callback(INITIAL_GIFTS.map((g, idx) => ({ ...g, id: `gift-seed-${idx + 1}` })));
        return;
      }

      shouldSeed = false;
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

      items.sort((a, b) => {
        if (a.status === 'sold_out' && b.status !== 'sold_out') return 1;
        if (a.status !== 'sold_out' && b.status === 'sold_out') return -1;
        return a.name.localeCompare(b.name);
      });

      callback(items);
    },
    (error) => {
      console.warn('Firestore subscription error:', error.message);
      callback(INITIAL_GIFTS.map((g, idx) => ({ ...g, id: `gift-seed-${idx + 1}` })));
    }
  );

  return unsubscribe;
}

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

export async function reserveGiftWithTransaction(params: {
  giftId: string;
  giftName?: string;
  guestName: string;
  guestWhatsapp: string;
  quantity: number;
  message?: string;
}): Promise<{ success: boolean; message?: string }> {
  const { giftId, giftName, guestName, guestWhatsapp, quantity, message } = params;

  if (quantity <= 0) {
    throw new Error('A quantidade precisa ser de pelo menos 1.');
  }
  if (!guestName.trim()) {
    throw new Error('Por favor, informe seu nome para a Alyne saber quem é!');
  }

  // Resolve gift name
  const currentGifts = getLocalMergedGifts();
  const foundGift = currentGifts.find((g) => g.id === giftId);
  const resolvedGiftName = giftName?.trim() || foundGift?.name || 'Presente Especial';

  if (!isFirebaseConfigured) {
    try {
      const reservations = getLocalStoredReservations();
      const newReservation: GiftReservation = {
        id: `local-res-${Date.now()}`,
        giftId,
        giftName: resolvedGiftName,
        guestName: guestName.trim(),
        guestWhatsapp: guestWhatsapp.trim(),
        quantity,
        message: message?.trim() || '',
        createdAt: new Date().toISOString(),
      };
      reservations.unshift(newReservation);
      saveLocalReservations(reservations);
      notifyReservationListeners();
      notifyGiftListeners();
    } catch (e) {
      console.warn('LocalStorage reservation save error:', e);
    }
    return { success: true };
  }

  const giftRef = doc(db, GIFTS_COLLECTION, giftId);

  try {
    await runTransaction(db, async (transaction) => {
      const giftDoc = await transaction.get(giftRef);

      if (!giftDoc.exists()) {
        throw new Error('Presente não encontrado.');
      }

      const data = giftDoc.data();
      const currentAvailable = Number(data.availableQuantity ?? 0);
      const status = data.status || 'available';

      if (status !== 'available') {
        throw new Error('Poxa! Esse presente não está disponível no momento.');
      }

      if (currentAvailable < quantity) {
        throw new Error('Poxa! Alguém acabou de pegar essa última cota. 😭');
      }

      const newAvailable = currentAvailable - quantity;
      const newReserved = Number(data.reservedQuantity || 0) + quantity;
      const newStatus = newAvailable <= 0 ? 'sold_out' : status;

      transaction.update(giftRef, {
        availableQuantity: newAvailable,
        reservedQuantity: newReserved,
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      const reservationRef = doc(collection(db, RESERVATIONS_COLLECTION));
      transaction.set(reservationRef, {
        giftId,
        giftName: data.name || resolvedGiftName,
        guestName: guestName.trim(),
        guestWhatsapp: guestWhatsapp.trim(),
        quantity,
        message: message?.trim() || '',
        createdAt: serverTimestamp(),
      });
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Não foi possível concluir a reserva.';

    if (message.includes('Poxa!')) {
      throw new Error(message);
    }

    if (message.includes('permission') || message.includes('permissão')) {
      throw new Error('Permissão negada ao reservar o presente.');
    }

    if (message.includes('network') || message.includes('offline') || message.includes('fetch')) {
      throw new Error('Sem conexão. Tente novamente em alguns segundos.');
    }

    throw new Error(message || 'Não foi possível concluir a reserva.');
  }
}

export function subscribeReservations(callback: (reservations: GiftReservation[]) => void) {
  if (!isFirebaseConfigured) {
    localReservationListeners.push(callback);
    callback(getLocalStoredReservations());
    return () => {
      localReservationListeners = localReservationListeners.filter((cb) => cb !== callback);
    };
  }

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
      callback([]);
    }
  );
}

export async function createGift(giftData: Omit<Gift, 'id'>): Promise<string> {
  const total = Number(giftData.totalQuantity || 1);

  if (!isFirebaseConfigured) {
    const id = `gift-custom-${Date.now()}`;
    const newGift: Gift = {
      ...giftData,
      id,
      totalQuantity: total,
      availableQuantity: total,
      reservedQuantity: 0,
      status: total > 0 ? 'available' : 'sold_out',
    };
    const list = getLocalCustomGifts();
    list.unshift(newGift);
    localStorage.setItem(LOCAL_CUSTOM_GIFTS_KEY, JSON.stringify(list));
    notifyGiftListeners();
    return id;
  }

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
  if (!isFirebaseConfigured) {
    const list = getLocalCustomGifts();
    const index = list.findIndex((g) => g.id === giftId);
    if (index >= 0) {
      list[index] = { ...list[index], ...giftData };
      localStorage.setItem(LOCAL_CUSTOM_GIFTS_KEY, JSON.stringify(list));
    } else {
      const overrides = getLocalGiftOverrides();
      overrides[giftId] = { ...(overrides[giftId] || {}), ...giftData };
      localStorage.setItem(LOCAL_GIFT_OVERRIDES_KEY, JSON.stringify(overrides));
    }
    notifyGiftListeners();
    return;
  }

  const giftRef = doc(db, GIFTS_COLLECTION, giftId);
  const updates: Record<string, unknown> = {
    ...giftData,
    updatedAt: serverTimestamp(),
  };
  delete updates.id;
  await updateDoc(giftRef, updates);
}

export async function deleteGift(giftId: string): Promise<void> {
  if (!isFirebaseConfigured) {
    const list = getLocalCustomGifts().filter((g) => g.id !== giftId);
    localStorage.setItem(LOCAL_CUSTOM_GIFTS_KEY, JSON.stringify(list));

    const deleted = getLocalDeletedGifts();
    if (!deleted.includes(giftId)) {
      deleted.push(giftId);
      localStorage.setItem(LOCAL_DELETED_GIFTS_KEY, JSON.stringify(deleted));
    }
    notifyGiftListeners();
    return;
  }

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
