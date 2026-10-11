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
  where,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { auth } from '../lib/firebase';
import { Gift, GiftCategory, GiftReservation, GiftStatus } from '../types';
import { INITIAL_GIFTS, INITIAL_RESERVATIONS } from '../data/defaultData';
import alynePortrait from '../assets/images/alyne_portrait_1790969104126.jpg';
import modernLivingRoom from '../assets/images/modern_living_room_1790969114799.jpg';
import kitchenDining from '../assets/images/kitchen_dining_bar_1790969125087.jpg';
import readingNook from '../assets/images/aesthetic_reading_nook_1790969135611.jpg';

const GIFTS_COLLECTION = 'gifts';
const RESERVATIONS_COLLECTION = 'giftReservations';

const LOCAL_CUSTOM_GIFTS_KEY = 'alyne_custom_gifts_v2';
const LOCAL_GIFT_OVERRIDES_KEY = 'alyne_gift_overrides_v2';
const LOCAL_DELETED_GIFTS_KEY = 'alyne_deleted_gifts_v2';
const LOCAL_RESERVATIONS_KEY = 'alyne_reservations_cache_v2';

let localGiftListeners: Array<(gifts: Gift[]) => void> = [];
let localReservationListeners: Array<(reservations: GiftReservation[]) => void> = [];

const GIFT_IMAGE_FALLBACKS: Partial<Record<GiftCategory, string>> = {
  casa: modernLivingRoom,
  cozinha: kitchenDining,
  sala: modernLivingRoom,
  quarto: readingNook,
  banheiro: modernLivingRoom,
  pix: alynePortrait,
  outros: modernLivingRoom,
};

const BUNDLED_IMAGE_PATHS = [
  { filename: 'alyne_portrait_1790969104126', url: alynePortrait },
  { filename: 'modern_living_room_1790969114799', url: modernLivingRoom },
  { filename: 'kitchen_dining_bar_1790969125087', url: kitchenDining },
  { filename: 'aesthetic_reading_nook_1790969135611', url: readingNook },
];

function resolveGiftImage(imageUrl: string | undefined, category: GiftCategory): string {
  const fallback = GIFT_IMAGE_FALLBACKS[category] || modernLivingRoom;
  const trimmedUrl = imageUrl?.trim();

  if (!trimmedUrl) return fallback;

  let imagePath = '';
  try {
    imagePath = new URL(trimmedUrl, 'https://assets.invalid').pathname;
  } catch {
    return trimmedUrl;
  }

  if (imagePath.startsWith('/src/assets/')) {
    const bundledImage = BUNDLED_IMAGE_PATHS.find((image) => imagePath.includes(image.filename));
    return bundledImage?.url || fallback;
  }

  return trimmedUrl;
}

export function getLocalStoredReservations(): GiftReservation[] {
  try {
    const raw = localStorage.getItem(LOCAL_RESERVATIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading local reservations:', e);
  }
  return [];
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
      merged.imageUrl = resolveGiftImage(merged.imageUrl, merged.category);
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

export const isAdminUser = () => {
  const email = auth?.currentUser?.email?.trim().toLowerCase();
  const envAdmin = (import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase();
  return Boolean(email && (email === envAdmin || email === 'alyne.custodio@dux-company.com' || email === 'alyne2.nobre.c@gmail.com'));
};

export function subscribeGifts(
  callback: (gifts: Gift[]) => void,
  onError?: (error: Error) => void
) {
  if (!isFirebaseConfigured || !db) {
    localGiftListeners.push(callback);
    callback(getLocalMergedGifts());
    return () => {
      localGiftListeners = localGiftListeners.filter((fn) => fn !== callback);
    };
  }

  const giftsRef = collection(db, GIFTS_COLLECTION);
  let hasAttemptedSeed = false;

  const unsubscribe = onSnapshot(
    giftsRef,
    async (snapshot) => {
      if (snapshot.empty) {
        if (isAdminUser() && !hasAttemptedSeed) {
          hasAttemptedSeed = true;
          try {
            await seedGiftsToFirestore();
            return;
          } catch (err) {
            console.warn('Could not auto-seed gifts:', err);
          }
        }
        callback([]);
        return;
      }

      const items: Gift[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || '',
          description: data.description || '',
          category: data.category || 'outros',
          imageUrl: resolveGiftImage(data.imageUrl, data.category || 'outros'),
          type: data.type || 'product',
          price: Number(data.price || 0),
          totalQuantity: Number(data.totalQuantity || 1),
          availableQuantity: Number(data.availableQuantity ?? 1),
          reservedQuantity: Number(data.reservedQuantity || 0),
          purchaseUrl: data.purchaseUrl || '',
          pixKey: data.pixKey || '',
          pixQrCodeUrl: data.pixQrCodeUrl || '',
          pixCopiaECola: data.pixCopiaECola || '',
          pixBankLink: data.pixBankLink || '',
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
      console.warn('Firestore gifts subscription error:', error.message);
      if (onError) onError(error);
      callback([]);
    }
  );

  return unsubscribe;
}

export async function seedGiftsToFirestore(): Promise<void> {
  if (!db || !isAdminUser()) return;
  const batch = writeBatch(db);
  const giftsRef = collection(db, GIFTS_COLLECTION);

  INITIAL_GIFTS.forEach((item) => {
    const newDoc = doc(giftsRef);
    batch.set(newDoc, {
      ...item,
      reservedQuantity: 0,
      availableQuantity: item.totalQuantity,
      status: item.totalQuantity > 0 ? 'available' : 'sold_out',
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
  if (!guestWhatsapp.trim()) {
    throw new Error('Por favor, informe seu WhatsApp para contato.');
  }

  const currentGifts = getLocalMergedGifts();
  const foundGift = currentGifts.find((g) => g.id === giftId);
  const resolvedGiftName = giftName?.trim() || foundGift?.name || 'Presente Especial';
  const resolvedUnitPrice = foundGift?.price || 0;

  if (!isFirebaseConfigured || !db) {
    try {
      const reservations = getLocalStoredReservations();
      const newReservation: GiftReservation = {
        id: `local-res-${Date.now()}`,
        giftId,
        giftName: resolvedGiftName,
        guestName: guestName.trim().slice(0, 80),
        guestWhatsapp: guestWhatsapp.trim().slice(0, 25),
        quantity,
        unitPrice: resolvedUnitPrice,
        totalAmount: resolvedUnitPrice * quantity,
        paid: false,
        message: (message || '').trim().slice(0, 500),
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

  const firestore = db;
  const giftRef = doc(firestore, GIFTS_COLLECTION, giftId);

  try {
    await runTransaction(firestore, async (transaction) => {
      const giftDoc = await transaction.get(giftRef);

      if (!giftDoc.exists()) {
        throw new Error('Presente não encontrado no banco de dados. A lista pode ter sido atualizada pela anfitriã.');
      }

      const data = giftDoc.data();
      const currentAvailable = Number(data.availableQuantity ?? 0);
      const status = data.status || 'available';
      const unitPrice = Number(data.price || 0);

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

      const reservationRef = doc(collection(firestore, RESERVATIONS_COLLECTION));
      transaction.set(reservationRef, {
        giftId,
        giftName: (data.name || resolvedGiftName).slice(0, 120),
        guestName: guestName.trim().slice(0, 80),
        guestWhatsapp: guestWhatsapp.trim().slice(0, 25),
        quantity,
        unitPrice,
        totalAmount: unitPrice * quantity,
        paid: false,
        message: (message || '').trim().slice(0, 500),
        createdAt: serverTimestamp(),
      });
    });

    return { success: true };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Não foi possível concluir a reserva.';

    if (errorMsg.includes('Poxa!') || errorMsg.includes('Presente não encontrado')) {
      throw new Error(errorMsg);
    }

    if (errorMsg.includes('permission') || errorMsg.includes('permissão')) {
      throw new Error('Permissão negada ao reservar o presente no servidor.');
    }

    if (errorMsg.includes('network') || errorMsg.includes('offline') || errorMsg.includes('fetch')) {
      throw new Error('Sem conexão com o servidor. Tente novamente em alguns segundos.');
    }

    throw new Error(errorMsg || 'Não foi possível concluir a reserva.');
  }
}

export function subscribeReservations(
  callback: (reservations: GiftReservation[]) => void,
  onError?: (error: Error) => void
) {
  if (!isFirebaseConfigured || !db) {
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
        const quantity = Number(d.quantity || 1);
        const unitPrice = Number(d.unitPrice || 0);
        const totalAmount = Number(d.totalAmount !== undefined ? d.totalAmount : unitPrice * quantity);

        return {
          id: docSnap.id,
          giftId: d.giftId || '',
          giftName: d.giftName || '',
          guestName: d.guestName || '',
          guestWhatsapp: d.guestWhatsapp || '',
          quantity,
          unitPrice,
          totalAmount,
          paid: Boolean(d.paid),
          paidAt: d.paidAt?.toDate ? d.paidAt.toDate().toISOString() : d.paidAt,
          message: d.message || '',
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : d.createdAt,
        };
      });
      callback(list);
    },
    (err) => {
      console.warn('Error fetching reservations:', err);
      if (onError) onError(err);
      callback([]);
    }
  );
}

export async function updateReservationPayment(
  reservationId: string,
  paid: boolean
): Promise<void> {
  const localList = getLocalStoredReservations();
  const index = localList.findIndex((r) => r.id === reservationId);
  if (index >= 0) {
    localList[index] = {
      ...localList[index],
      paid,
      paidAt: paid ? new Date().toISOString() : undefined,
    };
    saveLocalReservations(localList);
    notifyReservationListeners();
  }

  if (isFirebaseConfigured && db) {
    const reservationRef = doc(db, RESERVATIONS_COLLECTION, reservationId);
    await updateDoc(reservationRef, {
      paid,
      paidAt: paid ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    });
  }
}

export async function deleteReservation(reservationId: string): Promise<void> {
  const cachedReservation = getLocalStoredReservations().find((reservation) => reservation.id === reservationId);
  const cachedGift = cachedReservation
    ? getLocalMergedGifts().find((gift) => gift.id === cachedReservation.giftId)
    : undefined;

  if (isFirebaseConfigured && db) {
    const firestore = db;
    const reservationRef = doc(firestore, RESERVATIONS_COLLECTION, reservationId);
    await runTransaction(firestore, async (transaction) => {
      const reservationSnapshot = await transaction.get(reservationRef);
      if (!reservationSnapshot.exists()) return;

      const reservation = reservationSnapshot.data();
      const giftId = typeof reservation.giftId === 'string' ? reservation.giftId : '';
      const quantity = Math.max(0, Number(reservation.quantity) || 0);

      if (giftId && quantity > 0) {
        const giftRef = doc(firestore, GIFTS_COLLECTION, giftId);
        const giftSnapshot = await transaction.get(giftRef);

        if (giftSnapshot.exists()) {
          const gift = giftSnapshot.data();
          const totalQuantity = Math.max(0, Number(gift.totalQuantity) || 0);
          const currentReserved = Math.max(0, Number(gift.reservedQuantity) || 0);
          const currentAvailable = Math.max(0, Number(gift.availableQuantity) || 0);
          const newReserved = Math.max(0, currentReserved - quantity);
          const newAvailable = Math.min(
            Math.max(0, totalQuantity - newReserved),
            currentAvailable + quantity
          );
          const isUnavailable = gift.status === 'unavailable';

          transaction.update(giftRef, {
            reservedQuantity: newReserved,
            availableQuantity: newAvailable,
            status: isUnavailable ? 'unavailable' : newAvailable > 0 ? 'available' : 'sold_out',
            updatedAt: serverTimestamp(),
          });
        }
      }

      transaction.delete(reservationRef);
    });
  }

  const localList = getLocalStoredReservations().filter((r) => r.id !== reservationId);
  saveLocalReservations(localList);

  if (!isFirebaseConfigured && cachedReservation && cachedGift) {
    const reservedQuantity = Math.max(
      0,
      cachedGift.reservedQuantity - Math.max(0, cachedReservation.quantity || 0)
    );
    const availableQuantity = Math.max(0, cachedGift.totalQuantity - reservedQuantity);
    const restoredGiftState: Partial<Gift> = {
      reservedQuantity,
      availableQuantity,
      status: cachedGift.status === 'unavailable'
        ? 'unavailable'
        : availableQuantity > 0 ? 'available' : 'sold_out',
    };
    const customGifts = getLocalCustomGifts();
    const customGiftIndex = customGifts.findIndex((gift) => gift.id === cachedGift.id);

    if (customGiftIndex >= 0) {
      customGifts[customGiftIndex] = { ...customGifts[customGiftIndex], ...restoredGiftState };
      localStorage.setItem(LOCAL_CUSTOM_GIFTS_KEY, JSON.stringify(customGifts));
    } else {
      const overrides = getLocalGiftOverrides();
      overrides[cachedGift.id] = { ...(overrides[cachedGift.id] || {}), ...restoredGiftState };
      localStorage.setItem(LOCAL_GIFT_OVERRIDES_KEY, JSON.stringify(overrides));
    }
  }

  notifyReservationListeners();
  notifyGiftListeners();
}

export async function createGift(giftData: Omit<Gift, 'id'>): Promise<string> {
  const total = Number(giftData.totalQuantity || 1);

  if (!isFirebaseConfigured || !db) {
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
  if (!isFirebaseConfigured || !db) {
    const list = getLocalCustomGifts();
    const index = list.findIndex((g) => g.id === giftId);
    const currentGift = index >= 0
      ? list[index]
      : getLocalMergedGifts().find((gift) => gift.id === giftId);
    const updates = { ...giftData };

    if (updates.status === 'available' && currentGift) {
      const localReservations = getLocalStoredReservations().filter(
        (reservation) => reservation.giftId === giftId
      );
      const reservedQuantity = localReservations.length
        ? localReservations.reduce((total, reservation) => total + Math.max(0, reservation.quantity || 0), 0)
        : currentGift.reservedQuantity;
      const totalQuantity = Math.max(0, Number(updates.totalQuantity ?? currentGift.totalQuantity) || 0);
      updates.reservedQuantity = reservedQuantity;
      updates.availableQuantity = Math.max(0, totalQuantity - reservedQuantity);
      updates.status = updates.availableQuantity > 0 ? 'available' : 'sold_out';
    } else if (updates.status === 'sold_out') {
      updates.availableQuantity = 0;
    }

    if (index >= 0) {
      list[index] = { ...list[index], ...updates };
      localStorage.setItem(LOCAL_CUSTOM_GIFTS_KEY, JSON.stringify(list));
    } else {
      const overrides = getLocalGiftOverrides();
      overrides[giftId] = { ...(overrides[giftId] || {}), ...updates };
      localStorage.setItem(LOCAL_GIFT_OVERRIDES_KEY, JSON.stringify(overrides));
    }
    notifyGiftListeners();
    return;
  }

  const giftRef = doc(db, GIFTS_COLLECTION, giftId);
  const updatesToSave: Partial<Gift> = { ...giftData };
  const updates: Record<string, unknown> = {
    ...updatesToSave,
    updatedAt: serverTimestamp(),
  };
  delete updates.id;

  if (updatesToSave.status || typeof updatesToSave.totalQuantity === 'number') {
    const firestore = db;
    const reservationsSnapshot = await getDocs(query(
      collection(firestore, RESERVATIONS_COLLECTION),
      where('giftId', '==', giftId)
    ));
    const reservedQuantity = reservationsSnapshot.docs.reduce(
      (total, reservation) => total + Math.max(0, Number(reservation.data().quantity) || 0),
      0
    );

    await runTransaction(firestore, async (transaction) => {
      const giftSnapshot = await transaction.get(giftRef);
      if (!giftSnapshot.exists()) {
        throw new Error('Presente não encontrado para atualizar o status.');
      }

      const gift = giftSnapshot.data();
      const totalQuantity = Math.max(
        0,
        Number(updatesToSave.totalQuantity ?? gift.totalQuantity) || 0
      );
      const availableQuantity = Math.max(0, totalQuantity - reservedQuantity);
      const requestedStatus = updatesToSave.status || gift.status || 'available';
      const status: GiftStatus = requestedStatus === 'unavailable'
        ? 'unavailable'
        : requestedStatus === 'sold_out' || availableQuantity <= 0
          ? 'sold_out'
          : 'available';

      transaction.update(giftRef, {
        ...updates,
        reservedQuantity,
        availableQuantity: status === 'sold_out' ? 0 : availableQuantity,
        status,
      });
    });
    return;
  }

  await updateDoc(giftRef, updates);
}

export async function deleteGift(giftId: string): Promise<void> {
  if (!isFirebaseConfigured || !db) {
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
