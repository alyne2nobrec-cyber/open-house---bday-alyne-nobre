import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Guest, GuestStatus } from '../types';

const GUESTS_COLLECTION = 'guests';
const LOCAL_STORAGE_GUESTS_KEY = 'alyne_guests_cache_v1';

function getLocalGuests(): Guest[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_GUESTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('LocalStorage error:', e);
  }
  // Realistic initial guests
  return [
    {
      id: 'guest-1',
      name: 'Amanda Silveira',
      whatsapp: '(11) 98765-4321',
      attendees: 2,
      companions: ['Rodrigo Silveira'],
      status: 'confirmed',
      notes: 'Levaremos um vinho maravilhoso!',
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    },
    {
      id: 'guest-2',
      name: 'Lucas Brandão',
      whatsapp: '(11) 99123-5566',
      attendees: 1,
      companions: [],
      status: 'confirmed',
      notes: 'Não perco por nada!',
      createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    },
    {
      id: 'guest-3',
      name: 'Mariana Duarte',
      whatsapp: '(11) 97788-9900',
      attendees: 2,
      companions: ['Bruno Duarte'],
      status: 'confirmed',
      notes: 'Já ansiosa para conhecer o apê!',
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
  ];
}

function saveLocalGuests(guests: Guest[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_GUESTS_KEY, JSON.stringify(guests));
  } catch (e) {
    console.warn('LocalStorage error:', e);
  }
}

export function subscribeGuests(callback: (guests: Guest[]) => void) {
  const ref = collection(db, GUESTS_COLLECTION);
  const q = query(ref, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        callback(getLocalGuests());
        return;
      }

      const list: Guest[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          name: d.name || '',
          whatsapp: d.whatsapp || '',
          attendees: Number(d.attendees || 1),
          companions: Array.isArray(d.companions) ? d.companions : [],
          status: (d.status as GuestStatus) || 'confirmed',
          notes: d.notes || '',
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : d.createdAt,
        };
      });

      saveLocalGuests(list);
      callback(list);
    },
    (err) => {
      console.warn('Error subscribing to guests:', err);
      callback(getLocalGuests());
    }
  );
}

export async function registerRsvp(params: {
  name: string;
  whatsapp: string;
  attendees: number;
  companions?: string[];
  status: GuestStatus;
  notes?: string;
}): Promise<string> {
  const { name, whatsapp, attendees, companions = [], status, notes = '' } = params;

  if (!name.trim()) {
    throw new Error('Por favor, informe seu nome completo.');
  }
  if (!whatsapp.trim()) {
    throw new Error('Por favor, informe seu WhatsApp para combinarmos.');
  }

  try {
    const docRef = await addDoc(collection(db, GUESTS_COLLECTION), {
      name: name.trim(),
      whatsapp: whatsapp.trim(),
      attendees: status === 'confirmed' ? Math.max(1, attendees) : 0,
      companions: status === 'confirmed' ? companions.filter(c => c.trim().length > 0) : [],
      status,
      notes: notes.trim(),
      createdAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    console.warn('Saving RSVP to local cache due to connection:', error);
    const local = getLocalGuests();
    const newGuest: Guest = {
      id: `local-guest-${Date.now()}`,
      name: name.trim(),
      whatsapp: whatsapp.trim(),
      attendees: status === 'confirmed' ? Math.max(1, attendees) : 0,
      companions: status === 'confirmed' ? companions.filter(c => c.trim().length > 0) : [],
      status,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    };
    local.unshift(newGuest);
    saveLocalGuests(local);
    return newGuest.id;
  }
}

export async function deleteGuest(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, GUESTS_COLLECTION, id));
  } catch (err) {
    console.warn('Error deleting guest in firestore:', err);
  }
  const local = getLocalGuests().filter(g => g.id !== id);
  saveLocalGuests(local);
}
