import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDocs,
  writeBatch,
  setDoc,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { auth } from '../lib/firebase';
import { GiftReservation, Guest, GuestStatus } from '../types';
import { incrementConfirmedAttendees } from './eventStatsService';
import { normalizePhoneId } from '../utils/phone';

const GUESTS_COLLECTION = 'guests';
const LOCAL_GUESTS_KEY = 'alyne_guests_cache_v2';

let localGuestListeners: Array<(guests: Guest[]) => void> = [];
let guestMigrationRunning = false;

function makeGuestId(whatsapp?: string, name?: string): string {
  const phoneKey = normalizePhoneId(whatsapp);
  const safeName = normalizeGuestName(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return phoneKey ? `guest-${phoneKey}` : `guest-${safeName || 'anon'}-no-phone`;
}

function findMatchingGuest(list: Guest[], name: string, whatsapp?: string): Guest | undefined {
  const normalizedName = normalizeGuestName(name);
  const phoneKey = normalizePhoneId(whatsapp);
  const matches = list.filter((guest) => {
    const guestPhoneKey = normalizePhoneId(guest.whatsapp);
    return phoneKey
      ? guestPhoneKey === phoneKey
      : !guestPhoneKey && normalizeGuestName(guest.name) === normalizedName;
  });

  return matches.sort((a, b) => getTimestampMillis(a.createdAt) - getTimestampMillis(b.createdAt))[0];
}

function getTimestampMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  return 0;
}

function canManageGuests(): boolean {
  const email = auth?.currentUser?.email?.trim().toLowerCase();
  const envAdmin = (import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase();
  return Boolean(email && (
    email === envAdmin ||
    email === 'alyne.custodio@dux-company.com' ||
    email === 'alyne2.nobre.c@gmail.com'
  ));
}

function createGuestFromSnapshot(docSnap: QueryDocumentSnapshot<DocumentData>): Guest {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    name: data.name || '',
    whatsapp: data.whatsapp || '',
    maxCompanions: Number(data.maxCompanions ?? 1),
    attendees: Number(data.attendees || 0),
    companions: Array.isArray(data.companions) ? data.companions : [],
    status: (data.status as GuestStatus) || 'pending',
    notes: data.notes || '',
    confirmedAt: data.confirmedAt?.toDate ? data.confirmedAt.toDate().toISOString() : data.confirmedAt,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
  };
}

function consolidateLocalGuests(guests: Guest[]): Guest[] {
  const result: Guest[] = [];
  const phoneIndexes = new Map<string, number>();

  for (const guest of guests) {
    const phoneKey = normalizePhoneId(guest.whatsapp);
    if (!phoneKey) {
      result.push(guest);
      continue;
    }

    const existingIndex = phoneIndexes.get(phoneKey);
    if (existingIndex === undefined) {
      phoneIndexes.set(phoneKey, result.length);
      result.push({ ...guest, id: `guest-${phoneKey}` });
      continue;
    }

    const existing = result[existingIndex];
    const guestIsOlder = getTimestampMillis(guest.createdAt) < getTimestampMillis(existing.createdAt);
    const latestState = getTimestampMillis(guest.updatedAt ?? guest.confirmedAt) >
      getTimestampMillis(existing.updatedAt ?? existing.confirmedAt) ? guest : existing;
    result[existingIndex] = {
      ...(guestIsOlder ? guest : existing),
      id: `guest-${phoneKey}`,
      attendees: latestState.attendees,
      companions: latestState.companions,
      status: latestState.status,
      notes: latestState.notes,
      confirmedAt: latestState.confirmedAt,
      updatedAt: latestState.updatedAt,
    };
  }

  return result;
}

async function migrateGuestPhoneIds(
  docs: QueryDocumentSnapshot<DocumentData>[]
): Promise<void> {
  if (!db) return;

  const groups = new Map<string, QueryDocumentSnapshot<DocumentData>[]>();
  for (const guestDoc of docs) {
    const phoneKey = normalizePhoneId(guestDoc.data().whatsapp);
    if (!phoneKey) continue;
    const group = groups.get(phoneKey) || [];
    group.push(guestDoc);
    groups.set(phoneKey, group);
  }

  for (const [phoneKey, group] of groups) {
    const canonicalId = `guest-${phoneKey}`;
    if (group.length === 1 && group[0].id === canonicalId) continue;

    const oldestFirst = [...group].sort(
      (a, b) => getTimestampMillis(a.data().createdAt) - getTimestampMillis(b.data().createdAt)
    );
    const newestStateFirst = [...group].sort(
      (a, b) =>
        getTimestampMillis(b.data().updatedAt ?? b.data().confirmedAt ?? b.data().createdAt) -
        getTimestampMillis(a.data().updatedAt ?? a.data().confirmedAt ?? a.data().createdAt)
    );
    const firstData = oldestFirst[0].data();
    const latestData = newestStateFirst[0].data();
    const canonicalRef = doc(db, GUESTS_COLLECTION, canonicalId);

    await setDoc(canonicalRef, {
      ...firstData,
      name: firstData.name || latestData.name || '',
      whatsapp: firstData.whatsapp || latestData.whatsapp || '',
      maxCompanions: Number(firstData.maxCompanions ?? 1),
      attendees: Number(latestData.attendees ?? firstData.attendees ?? 0),
      companions: Array.isArray(latestData.companions)
        ? latestData.companions
        : Array.isArray(firstData.companions) ? firstData.companions : [],
      status: latestData.status || firstData.status || 'pending',
      notes: latestData.notes || firstData.notes || '',
      confirmedAt: latestData.confirmedAt || firstData.confirmedAt || null,
      createdAt: firstData.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const duplicateDocs = oldestFirst.filter((guestDoc) => guestDoc.id !== canonicalId);
    for (let offset = 0; offset < duplicateDocs.length; offset += 450) {
      const batch = writeBatch(db);
      duplicateDocs.slice(offset, offset + 450).forEach((guestDoc) => batch.delete(guestDoc.ref));
      await batch.commit();
    }
  }
}

export function getLocalStoredGuests(): Guest[] {
  try {
    const raw = localStorage.getItem(LOCAL_GUESTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading local guests:', e);
  }
  return [];
}

function saveLocalGuests(list: Guest[]) {
  try {
    localStorage.setItem(LOCAL_GUESTS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Error saving local guests:', e);
  }
}

function notifyGuestListeners() {
  const list = getLocalStoredGuests();
  localGuestListeners.forEach((fn) => fn(list));
}

export function subscribeGuests(
  callback: (guests: Guest[]) => void,
  onError?: (error: Error) => void
) {
  if (!isFirebaseConfigured || !db) {
    localGuestListeners.push(callback);
    const storedGuests = getLocalStoredGuests();
    const consolidatedGuests = consolidateLocalGuests(storedGuests);
    if (consolidatedGuests.length !== storedGuests.length || consolidatedGuests.some(
      (guest, index) => guest.id !== storedGuests[index]?.id
    )) {
      saveLocalGuests(consolidatedGuests);
    }
    callback(consolidatedGuests);
    return () => {
      localGuestListeners = localGuestListeners.filter((fn) => fn !== callback);
    };
  }

  const ref = collection(db, GUESTS_COLLECTION);
  const q = query(ref, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        callback([]);
        return;
      }

      const list: Guest[] = snapshot.docs.map(createGuestFromSnapshot);

      callback(list);

      const hasLegacyPhoneIds = snapshot.docs.some((guestDoc) => {
        const phoneKey = normalizePhoneId(guestDoc.data().whatsapp);
        return phoneKey && guestDoc.id !== `guest-${phoneKey}`;
      });
      if (canManageGuests() && hasLegacyPhoneIds && !guestMigrationRunning) {
        guestMigrationRunning = true;
        void migrateGuestPhoneIds(snapshot.docs)
          .catch((error: unknown) => {
            console.error('Could not consolidate guest phone records:', error);
            onError?.(error instanceof Error ? error : new Error('Não foi possível consolidar os convidados duplicados.'));
          })
          .finally(() => {
            guestMigrationRunning = false;
          });
      }
    },
    (err) => {
      console.warn('Firestore guests subscription error:', err);
      if (onError) onError(err);
      callback([]);
    }
  );
}

export function normalizeGuestName(name?: string): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function getReservationsForGuest(
  guest: Pick<Guest, 'name' | 'whatsapp'>,
  reservations: GiftReservation[]
): GiftReservation[] {
  const guestName = normalizeGuestName(guest.name);
  const guestPhone = normalizePhoneId(guest.whatsapp);

  return reservations.filter((reservation) => {
    const reservationName = normalizeGuestName(reservation.guestName);
    const reservationPhone = normalizePhoneId(reservation.guestWhatsapp);

    if (!guestName && !guestPhone) return false;

    if (guestPhone && reservationPhone && guestPhone === reservationPhone) return true;
    if (guestName && reservationName && guestName === reservationName) return true;
    if (guestName && reservationName && reservationName.includes(guestName)) return true;
    if (guestPhone && reservationPhone && reservationPhone.includes(guestPhone)) return true;

    return false;
  });
}

/**
 * Open RSVP submission from public guest
 * Adheres strictly to isValidGuestCreate() in firestore.rules
 */
export async function createGuestRsvp(params: {
  name: string;
  whatsapp: string;
  status: 'confirmed' | 'declined';
  attendees: number;
  companions?: string[];
  notes?: string;
}): Promise<string> {
  const { name, whatsapp, status, attendees, companions = [], notes = '' } = params;

  const cleanName = name.trim().slice(0, 80);
  const cleanWhatsapp = whatsapp.trim().slice(0, 25);
  const cleanCompanions = companions
    .map((c) => c.trim().slice(0, 80))
    .filter((c) => c.length > 0)
    .slice(0, 9);
  const cleanNotes = (notes || '').trim().slice(0, 500);

  if (!cleanName) {
    throw new Error('Por favor, informe seu nome completo.');
  }
  if (!cleanWhatsapp || cleanWhatsapp.length < 8) {
    throw new Error('Por favor, informe seu WhatsApp para contato (mínimo 8 dígitos).');
  }

  const finalAttendees = status === 'confirmed' ? Math.max(1, Math.min(10, attendees)) : 0;
  const phoneKey = normalizePhoneId(cleanWhatsapp);
  const guestId = makeGuestId(cleanWhatsapp, cleanName);

  const existingLocal = findMatchingGuest(getLocalStoredGuests(), cleanName, cleanWhatsapp);
  const targetId = guestId;

  // 1. Salvar no Firestore PRIMEIRO (se configurado)
  if (isFirebaseConfigured && db) {
    try {
      const firestoreGuestDoc = doc(db, GUESTS_COLLECTION, targetId);
      const payload: Record<string, unknown> = {
        attendees: finalAttendees,
        companions: status === 'confirmed' ? cleanCompanions : [],
        status,
        ...(cleanNotes ? { notes: cleanNotes } : {}),
        confirmedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      try {
        await updateDoc(firestoreGuestDoc, payload);
      } catch (error: unknown) {
        const isMissingDocument = error && typeof error === 'object' &&
          'code' in error && error.code === 'not-found';
        if (!isMissingDocument) throw error;
        await setDoc(firestoreGuestDoc, {
          ...payload,
          name: cleanName,
          whatsapp: cleanWhatsapp,
          createdAt: serverTimestamp(),
        });
      }
    } catch (e: unknown) {
      console.error('Firebase guest creation error:', e);
      throw new Error('Não foi possível enviar sua confirmação. Verifique sua conexão e tente novamente.');
    }
  }

  // 2. Incrementar contador eventStats SOMENTE após gravação com sucesso
  if (status === 'confirmed' && finalAttendees > 0 && (!existingLocal || existingLocal.status !== 'confirmed' || existingLocal.attendees !== finalAttendees)) {
    const delta = Math.max(0, finalAttendees - (existingLocal?.attendees || 0));
    if (delta > 0) {
      try {
        await incrementConfirmedAttendees(delta);
      } catch (e) {
        console.warn('Stats counter error:', e);
      }
    }
  }

  // 3. Atualizar cache local
  const guestData: Guest = {
    id: targetId,
    name: existingLocal?.name || cleanName,
    whatsapp: existingLocal?.whatsapp || cleanWhatsapp,
    maxCompanions: existingLocal?.maxCompanions ?? Math.max(1, cleanCompanions.length),
    attendees: finalAttendees,
    companions: status === 'confirmed' ? cleanCompanions : [],
    status,
    notes: cleanNotes || existingLocal?.notes || '',
    confirmedAt: new Date().toISOString(),
    createdAt: existingLocal?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const list = getLocalStoredGuests();
  const matchingIndexes = list
    .map((guest, index) => ({ guest, index }))
    .filter(({ guest }) => guest.id === targetId || (
      phoneKey
        ? normalizePhoneId(guest.whatsapp) === phoneKey
        : normalizeGuestName(guest.name) === normalizeGuestName(cleanName) &&
          !normalizePhoneId(guest.whatsapp)
    ));
  const preferredLocal = findMatchingGuest(list, cleanName, cleanWhatsapp);
  const retainedGuest = {
    ...guestData,
    name: preferredLocal?.name || guestData.name,
    whatsapp: preferredLocal?.whatsapp || guestData.whatsapp,
    maxCompanions: preferredLocal?.maxCompanions ?? guestData.maxCompanions,
    createdAt: preferredLocal?.createdAt || guestData.createdAt,
  };
  const insertionIndex = matchingIndexes.length ? matchingIndexes[0].index : 0;
  const filteredList = list.filter((_, index) => !matchingIndexes.some((match) => match.index === index));
  filteredList.splice(Math.min(insertionIndex, filteredList.length), 0, retainedGuest);
  saveLocalGuests(filteredList);
  notifyGuestListeners();

  return targetId;
}

/**
 * Add a guest manually from the admin panel
 */
export async function addGuest(params: {
  name: string;
  whatsapp?: string;
  maxCompanions?: number;
  status?: GuestStatus;
  attendees?: number;
  companions?: string[];
  notes?: string;
}): Promise<string> {
  const {
    name,
    whatsapp = '',
    maxCompanions = 1,
    status = 'pending',
    attendees = 0,
    companions = [],
    notes = '',
  } = params;

  if (!name.trim()) {
    throw new Error('Informe o nome do convidado.');
  }

  const localMatch = findMatchingGuest(getLocalStoredGuests(), name, whatsapp);
  if (localMatch) return localMatch.id;

  if (isFirebaseConfigured && db) {
    const remoteSnapshot = await getDocs(collection(db, GUESTS_COLLECTION));
    const remoteMatch = findMatchingGuest(
      remoteSnapshot.docs.map(createGuestFromSnapshot),
      name,
      whatsapp
    );
    if (remoteMatch) return remoteMatch.id;
  }

  const guestDocId = makeGuestId(whatsapp, name);

  const newGuest: Guest = {
    id: guestDocId,
    name: name.trim().slice(0, 80),
    whatsapp: whatsapp.trim().slice(0, 25),
    maxCompanions: Math.max(0, Number(maxCompanions)),
    attendees: status === 'confirmed' ? Math.max(1, attendees) : 0,
    companions: status === 'confirmed' ? companions : [],
    status,
    notes: notes.trim().slice(0, 500),
    createdAt: new Date().toISOString(),
  };

  const list = getLocalStoredGuests();
  list.unshift(newGuest);
  saveLocalGuests(list);
  notifyGuestListeners();

  if (isFirebaseConfigured && db) {
    try {
      const guestRef = doc(db, GUESTS_COLLECTION, guestDocId);
      await setDoc(guestRef, {
        name: newGuest.name,
        whatsapp: newGuest.whatsapp,
        maxCompanions: newGuest.maxCompanions,
        attendees: newGuest.attendees,
        companions: newGuest.companions,
        status: newGuest.status,
        ...(newGuest.notes ? { notes: newGuest.notes } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return guestDocId;
    } catch (e) {
      console.warn('Firebase setDoc error, kept local:', e);
      throw new Error('Não foi possível salvar o convidado no banco de dados.');
    }
  }

  return newGuest.id;
}

/**
 * Add multiple guests in batch (e.g. pasted lines)
 */
export async function addGuestsBatch(names: string[], defaultMaxCompanions = 1): Promise<number> {
  const cleanNames = names
    .map((n) => n.trim())
    .filter((n) => n.length > 1);

  if (cleanNames.length === 0) return 0;

  const list = getLocalStoredGuests();
  const addedList: Guest[] = [];

  for (const rawName of cleanNames) {
    const newGuest: Guest = {
      id: `guest-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: rawName.slice(0, 80),
      whatsapp: '00000000',
      maxCompanions: defaultMaxCompanions,
      attendees: 0,
      companions: [],
      status: 'pending',
      notes: '',
      createdAt: new Date().toISOString(),
    };
    addedList.push(newGuest);
  }

  const updated = [...addedList, ...list];
  saveLocalGuests(updated);
  notifyGuestListeners();

  if (isFirebaseConfigured && db) {
    for (const g of addedList) {
      try {
        const guestRef = doc(db, GUESTS_COLLECTION, g.id);
        await setDoc(guestRef, {
          name: g.name,
          whatsapp: g.whatsapp,
          maxCompanions: g.maxCompanions,
          attendees: g.attendees,
          companions: g.companions,
          status: g.status,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn('Firebase batch add failed:', e);
      }
    }
  }

  return cleanNames.length;
}

/**
 * Import a list of parsed guests from CSV
 * Mode 'replace' truly deletes existing Firestore guests before inserting!
 */
export async function importGuestsFromList(
  guestsList: Array<{
    name: string;
    whatsapp?: string;
    maxCompanions?: number;
    status?: GuestStatus;
    attendees?: number;
    companions?: string[];
    notes?: string;
  }>,
  mode: 'append' | 'replace' = 'append'
): Promise<number> {
  let current = mode === 'replace' ? [] : getLocalStoredGuests();
  if (mode === 'append' && isFirebaseConfigured && db) {
    const remoteSnapshot = await getDocs(collection(db, GUESTS_COLLECTION));
    current = consolidateLocalGuests([
      ...current,
      ...remoteSnapshot.docs.map(createGuestFromSnapshot),
    ]);
  }
  const newItems: Guest[] = [];
  const seenGuests = [...current];

  for (const item of guestsList) {
    if (!item.name || !item.name.trim()) continue;
    const maxComp = Number.isFinite(Number(item.maxCompanions)) ? Math.max(0, Number(item.maxCompanions)) : 1;
    const status: GuestStatus = item.status || 'pending';
    const attendees = status === 'confirmed' ? Math.max(1, Number(item.attendees || 1)) : 0;
    const guestDocId = makeGuestId(item.whatsapp, item.name);

    const g: Guest = {
      id: guestDocId,
      name: item.name.trim().slice(0, 80),
      whatsapp: (item.whatsapp?.trim() || '00000000').slice(0, 25),
      maxCompanions: maxComp,
      attendees,
      companions: Array.isArray(item.companions) ? item.companions : [],
      status,
      notes: (item.notes?.trim() || '').slice(0, 500),
      createdAt: new Date().toISOString(),
    };
    if (findMatchingGuest(seenGuests, g.name, g.whatsapp)) continue;
    newItems.push(g);
    seenGuests.push(g);
  }

  const combined = mode === 'replace' ? newItems : [...newItems, ...current];
  saveLocalGuests(combined);
  notifyGuestListeners();

  if (isFirebaseConfigured && db) {
    // If replace mode: delete all existing guests in Firestore first!
    if (mode === 'replace') {
      try {
        const snap = await getDocs(collection(db, GUESTS_COLLECTION));
        const batch = writeBatch(db);
        snap.docs.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      } catch (err) {
        console.warn('Could not clear existing Firestore guests:', err);
      }
    }

    // Insert new guests using setDoc with deterministic IDs
    for (const g of newItems) {
      try {
        const guestRef = doc(db, GUESTS_COLLECTION, g.id);
        await setDoc(guestRef, {
          name: g.name,
          whatsapp: g.whatsapp,
          maxCompanions: g.maxCompanions,
          attendees: g.attendees,
          companions: g.companions,
          status: g.status,
          ...(g.notes ? { notes: g.notes } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn('Firebase importGuestsFromList failed for row:', e);
      }
    }
  }

  return newItems.length;
}

/**
 * Update an existing guest
 */
export async function updateGuest(guestId: string, updates: Partial<Guest>): Promise<void> {
  const list = getLocalStoredGuests();
  const index = list.findIndex((g) => g.id === guestId);
  if (index >= 0) {
    list[index] = { ...list[index], ...updates, updatedAt: new Date().toISOString() };
    saveLocalGuests(list);
    notifyGuestListeners();
  }

  if (isFirebaseConfigured && db) {
    try {
      const ref = doc(db, GUESTS_COLLECTION, guestId);
      const cleanUpdates: Record<string, unknown> = {
        ...updates,
        updatedAt: serverTimestamp(),
      };
      delete cleanUpdates.id;
      await updateDoc(ref, cleanUpdates);
    } catch (e) {
      console.warn('Firebase updateDoc error:', e);
      throw new Error('Não foi possível atualizar o convidado no banco de dados.');
    }
  }
}

/**
 * Delete a guest from the list
 */
export async function deleteGuest(guestId: string): Promise<void> {
  const list = getLocalStoredGuests().filter((g) => g.id !== guestId);
  saveLocalGuests(list);
  notifyGuestListeners();

  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, GUESTS_COLLECTION, guestId));
    } catch (e) {
      console.warn('Firebase deleteDoc error:', e);
      throw new Error('Não foi possível excluir o convidado no banco de dados.');
    }
  }
}
