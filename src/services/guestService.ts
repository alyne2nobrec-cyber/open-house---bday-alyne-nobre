import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDocs,
  writeBatch,
  setDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { GiftReservation, Guest, GuestStatus } from '../types';
import { incrementConfirmedAttendees } from './eventStatsService';
import { normalizePhoneId } from '../utils/phone';

const GUESTS_COLLECTION = 'guests';
const LOCAL_GUESTS_KEY = 'alyne_guests_cache_v2';

let localGuestListeners: Array<(guests: Guest[]) => void> = [];

function makeGuestId(name: string, whatsapp?: string): string {
  const phoneKey = normalizePhoneId(whatsapp);
  if (phoneKey) return `guest-${phoneKey}`;
  const safeName = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `guest-${safeName || 'anon'}-${Date.now()}`;
}

function findMatchingGuest(list: Guest[], name: string, whatsapp?: string): Guest | undefined {
  const normalizedName = name.trim().toLowerCase();
  const phoneKey = normalizePhoneId(whatsapp);

  if (phoneKey) {
    const byPhone = list.find((guest) => normalizePhoneId(guest.whatsapp) === phoneKey);
    if (byPhone) return byPhone;
  }

  return list.find((guest) => (guest.name || '').trim().toLowerCase() === normalizedName);
}

async function findMatchingGuestInFirestore(name: string, whatsapp?: string): Promise<{ id: string; data: any } | undefined> {
  if (!isFirebaseConfigured || !db) return undefined;

  const phoneKey = normalizePhoneId(whatsapp);
  const normalizedName = name.trim().toLowerCase();
  const snapshot = await getDocs(collection(db, GUESTS_COLLECTION));

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (phoneKey && normalizePhoneId(data.whatsapp) === phoneKey) {
      return { id: docSnap.id, data };
    }
    if ((data.name || '').trim().toLowerCase() === normalizedName) {
      return { id: docSnap.id, data };
    }
  }

  return undefined;
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
    callback(getLocalStoredGuests());
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

      const list: Guest[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          name: d.name || '',
          whatsapp: d.whatsapp || '',
          maxCompanions: Number(d.maxCompanions ?? 1),
          attendees: Number(d.attendees || 0),
          companions: Array.isArray(d.companions) ? d.companions : [],
          status: (d.status as GuestStatus) || 'pending',
          notes: d.notes || '',
          confirmedAt: d.confirmedAt?.toDate ? d.confirmedAt.toDate().toISOString() : d.confirmedAt,
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : d.createdAt,
          updatedAt: d.updatedAt?.toDate ? d.updatedAt.toDate().toISOString() : d.updatedAt,
        };
      });

      callback(list);
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
  const guestId = makeGuestId(cleanName, cleanWhatsapp);
  const existingLocal = findMatchingGuest(getLocalStoredGuests(), cleanName, cleanWhatsapp);
  const existingRemote = await findMatchingGuestInFirestore(cleanName, cleanWhatsapp);
  const existingGuest = existingLocal || (existingRemote ? {
    id: existingRemote.id,
    name: cleanName,
    whatsapp: cleanWhatsapp,
    maxCompanions: cleanCompanions.length,
    attendees: Number(existingRemote.data?.attendees || 0),
    companions: Array.isArray(existingRemote.data?.companions) ? existingRemote.data.companions : [],
    status: existingRemote.data?.status || 'pending',
    notes: existingRemote.data?.notes || '',
    confirmedAt: existingRemote.data?.confirmedAt,
    createdAt: existingRemote.data?.createdAt,
  } as Guest : undefined);

  const guestData: Guest = {
    id: existingGuest?.id || guestId,
    name: cleanName,
    whatsapp: cleanWhatsapp,
    maxCompanions: cleanCompanions.length,
    attendees: finalAttendees,
    companions: status === 'confirmed' ? cleanCompanions : [],
    status,
    notes: cleanNotes,
    confirmedAt: new Date().toISOString(),
    createdAt: existingGuest?.createdAt || new Date().toISOString(),
  };

  const list = getLocalStoredGuests();
  if (existingGuest) {
    const index = list.findIndex((guest) => guest.id === existingGuest.id || (guest.name || '').trim().toLowerCase() === cleanName.toLowerCase() || normalizePhoneId(guest.whatsapp) === normalizePhoneId(cleanWhatsapp));
    if (index >= 0) {
      list[index] = { ...list[index], ...guestData, id: existingGuest.id, updatedAt: new Date().toISOString() };
    } else {
      list.unshift(guestData);
    }
  } else {
    list.unshift(guestData);
  }
  saveLocalGuests(list);
  notifyGuestListeners();

  if (status === 'confirmed' && finalAttendees > 0 && (!existingGuest || existingGuest.status !== 'confirmed' || existingGuest.attendees !== finalAttendees)) {
    const delta = Math.max(0, finalAttendees - (existingGuest?.attendees || 0));
    if (delta > 0) {
      try {
        await incrementConfirmedAttendees(delta);
      } catch (e) {
        console.warn('Stats counter error:', e);
      }
    }
  }

  if (isFirebaseConfigured && db) {
    try {
      const firestoreGuestDoc = existingRemote ? doc(db, GUESTS_COLLECTION, existingRemote.id) : doc(collection(db, GUESTS_COLLECTION), existingGuest?.id || guestId);
      const payload = {
        name: cleanName,
        whatsapp: cleanWhatsapp,
        attendees: finalAttendees,
        companions: status === 'confirmed' ? cleanCompanions : [],
        status,
        ...(cleanNotes ? { notes: cleanNotes } : {}),
        updatedAt: serverTimestamp(),
        ...(existingRemote ? {} : { createdAt: serverTimestamp() }),
      };

      if (existingRemote) {
        await setDoc(firestoreGuestDoc, payload, { merge: true });
      } else {
        await setDoc(firestoreGuestDoc, payload, { merge: true });
      }
      return existingRemote?.id || existingGuest?.id || guestId;
    } catch (e: any) {
      console.error('Firebase guest creation error:', e);
      throw new Error('Não foi possível enviar sua confirmação. Verifique sua conexão e tente novamente.');
    }
  }

  return guestData.id;
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

  const newGuest: Guest = {
    id: `guest-${Date.now()}`,
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
      const docRef = await addDoc(collection(db, GUESTS_COLLECTION), {
        name: newGuest.name,
        whatsapp: newGuest.whatsapp,
        attendees: newGuest.attendees,
        companions: newGuest.companions,
        status: newGuest.status,
        ...(newGuest.notes ? { notes: newGuest.notes } : {}),
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (e) {
      console.warn('Firebase addDoc error, kept local:', e);
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
        await addDoc(collection(db, GUESTS_COLLECTION), {
          name: g.name,
          whatsapp: g.whatsapp,
          attendees: g.attendees,
          companions: g.companions,
          status: g.status,
          createdAt: serverTimestamp(),
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
  const current = mode === 'replace' ? [] : getLocalStoredGuests();
  const newItems: Guest[] = [];

  for (const item of guestsList) {
    if (!item.name || !item.name.trim()) continue;
    const maxComp = Number.isFinite(Number(item.maxCompanions)) ? Math.max(0, Number(item.maxCompanions)) : 1;
    const status: GuestStatus = item.status || 'pending';
    const attendees = status === 'confirmed' ? Math.max(1, Number(item.attendees || 1)) : 0;

    const g: Guest = {
      id: `guest-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: item.name.trim().slice(0, 80),
      whatsapp: (item.whatsapp?.trim() || '00000000').slice(0, 25),
      maxCompanions: maxComp,
      attendees,
      companions: Array.isArray(item.companions) ? item.companions : [],
      status,
      notes: (item.notes?.trim() || '').slice(0, 500),
      createdAt: new Date().toISOString(),
    };
    newItems.push(g);
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

    // Insert new guests
    for (const g of newItems) {
      try {
        await addDoc(collection(db, GUESTS_COLLECTION), {
          name: g.name,
          whatsapp: g.whatsapp,
          attendees: g.attendees,
          companions: g.companions,
          status: g.status,
          ...(g.notes ? { notes: g.notes } : {}),
          createdAt: serverTimestamp(),
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
