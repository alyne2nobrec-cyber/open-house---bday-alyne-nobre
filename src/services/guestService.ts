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
  getDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { Guest, GuestStatus } from '../types';
import { INITIAL_GUESTS } from '../data/defaultData';

const GUESTS_COLLECTION = 'guests';
const LOCAL_GUESTS_KEY = 'alyne_guests_cache_v2';

let localGuestListeners: Array<(guests: Guest[]) => void> = [];

function getLocalStoredGuests(): Guest[] {
  try {
    const raw = localStorage.getItem(LOCAL_GUESTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading local guests:', e);
  }

  // Seed default guests if empty
  const seeded: Guest[] = INITIAL_GUESTS.map((g, idx) => ({
    ...g,
    id: `guest-seed-${idx + 1}`,
    createdAt: new Date().toISOString(),
  }));
  try {
    localStorage.setItem(LOCAL_GUESTS_KEY, JSON.stringify(seeded));
  } catch {}
  return seeded;
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

export function subscribeGuests(callback: (guests: Guest[]) => void) {
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
    async (snapshot) => {
      if (snapshot.empty) {
        callback(getLocalStoredGuests());
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
          confirmedAt: d.confirmedAt,
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : d.createdAt,
          updatedAt: d.updatedAt?.toDate ? d.updatedAt.toDate().toISOString() : d.updatedAt,
        };
      });

      callback(list);
    },
    (err) => {
      console.warn('Firestore guests subscription error:', err);
      callback(getLocalStoredGuests());
    }
  );
}

/**
 * Add a new guest to the guest list
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
    name: name.trim(),
    whatsapp: whatsapp.trim(),
    maxCompanions: Math.max(0, Number(maxCompanions)),
    attendees: status === 'confirmed' ? Math.max(1, attendees) : 0,
    companions: status === 'confirmed' ? companions : [],
    status,
    notes: notes.trim(),
    createdAt: new Date().toISOString(),
  };

  const list = getLocalStoredGuests();
  list.unshift(newGuest);
  saveLocalGuests(list);
  notifyGuestListeners();

  if (isFirebaseConfigured) {
    try {
      const docRef = await addDoc(collection(db, GUESTS_COLLECTION), {
        ...newGuest,
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
      name: rawName,
      whatsapp: '',
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

  if (isFirebaseConfigured) {
    for (const g of addedList) {
      try {
        await addDoc(collection(db, GUESTS_COLLECTION), {
          ...g,
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn('Firebase batch add failed:', e);
        throw new Error('Não foi possível importar todos os convidados no banco de dados.');
      }
    }
  }

  return cleanNames.length;
}

/**
 * Import a list of parsed guests from CSV
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
      name: item.name.trim(),
      whatsapp: item.whatsapp?.trim() || '',
      maxCompanions: maxComp,
      attendees,
      companions: Array.isArray(item.companions) ? item.companions : [],
      status,
      notes: item.notes?.trim() || '',
      createdAt: new Date().toISOString(),
    };
    newItems.push(g);
  }

  const combined = mode === 'replace' ? newItems : [...newItems, ...current];
  saveLocalGuests(combined);
  notifyGuestListeners();

  if (isFirebaseConfigured) {
    for (const g of newItems) {
      try {
        await addDoc(collection(db, GUESTS_COLLECTION), {
          ...g,
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn('Firebase importGuestsFromList failed:', e);
        throw new Error('Não foi possível importar os convidados no banco de dados.');
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

  if (isFirebaseConfigured) {
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

  if (isFirebaseConfigured) {
    try {
      await deleteDoc(doc(db, GUESTS_COLLECTION, guestId));
    } catch (e) {
      console.warn('Firebase deleteDoc error:', e);
      throw new Error('Não foi possível excluir o convidado no banco de dados.');
    }
  }
}

/**
 * Confirm or decline RSVP by an invited guest.
 * Verifies that the guest exists on the list and that companions do not exceed maxCompanions.
 */
export async function confirmGuestRsvp(params: {
  guestId: string;
  name: string;
  whatsapp: string;
  status: GuestStatus;
  attendees: number;
  companions: string[];
  notes?: string;
}): Promise<Guest> {
  const { guestId, name, whatsapp, status, attendees, companions, notes = '' } = params;

  let guest: Guest | undefined;

  if (isFirebaseConfigured) {
    const guestRef = doc(db, GUESTS_COLLECTION, guestId);
    const snap = await getDoc(guestRef);
    if (!snap.exists()) {
      throw new Error('Convidado não encontrado na lista oficial de convidados.');
    }

    const d = snap.data();
    guest = {
      id: snap.id,
      name: d.name || '',
      whatsapp: d.whatsapp || '',
      maxCompanions: Number(d.maxCompanions ?? 1),
      attendees: Number(d.attendees || 0),
      companions: Array.isArray(d.companions) ? d.companions : [],
      status: (d.status as GuestStatus) || 'pending',
      notes: d.notes || '',
      confirmedAt: d.confirmedAt,
      createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : d.createdAt,
      updatedAt: d.updatedAt?.toDate ? d.updatedAt.toDate().toISOString() : d.updatedAt,
    };
  } else {
    const list = getLocalStoredGuests();
    guest = list.find((g) => g.id === guestId);
  }

  if (!guest) {
    throw new Error('Convidado não encontrado na lista oficial de convidados.');
  }

  // Validate allowed companions
  const allowedMax = guest.maxCompanions;
  const filteredCompanions = companions.map((c) => c.trim()).filter((c) => c.length > 0);

  if (status === 'confirmed') {
    if (filteredCompanions.length > allowedMax) {
      throw new Error(`Seu convite permite no máximo ${allowedMax} acompanhante(s).`);
    }
  }

  const finalAttendees = status === 'confirmed' ? 1 + filteredCompanions.length : 0;
  const finalCompanions = status === 'confirmed' ? filteredCompanions : [];

  const updated: Guest = {
    ...guest,
    name: name.trim() || guest.name,
    whatsapp: whatsapp.trim() || guest.whatsapp,
    status,
    attendees: finalAttendees,
    companions: finalCompanions,
    notes: notes.trim(),
    confirmedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const index = getLocalStoredGuests().findIndex((g) => g.id === guestId);
  if (index >= 0) {
    const list = getLocalStoredGuests();
    list[index] = updated;
    saveLocalGuests(list);
    notifyGuestListeners();
  }

  if (isFirebaseConfigured) {
    try {
      const ref = doc(db, GUESTS_COLLECTION, guestId);
      await updateDoc(ref, {
        name: updated.name,
        whatsapp: updated.whatsapp,
        status: updated.status,
        attendees: updated.attendees,
        companions: updated.companions,
        notes: updated.notes,
        confirmedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Firebase confirmGuestRsvp error:', e);
      throw new Error('Não foi possível registrar a confirmação no banco de dados.');
    }
  }

  return updated;
}
