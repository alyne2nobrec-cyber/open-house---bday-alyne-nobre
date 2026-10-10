import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { EventStats } from '../types';

const STATS_DOC_PATH = 'eventStats';
const STATS_DOC_ID = 'main';
const LOCAL_STATS_KEY = 'alyne_event_stats_cache_v2';

let localStatsListeners: Array<(stats: EventStats) => void> = [];

export function getLocalStats(): EventStats {
  try {
    const raw = localStorage.getItem(LOCAL_STATS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.confirmedPeople === 'number') {
        return parsed;
      }
    }
  } catch {}
  return { confirmedPeople: 0 };
}

function saveLocalStats(stats: EventStats) {
  try {
    localStorage.setItem(LOCAL_STATS_KEY, JSON.stringify(stats));
    localStatsListeners.forEach((fn) => fn(stats));
  } catch {}
}

export function subscribeEventStats(callback: (stats: EventStats) => void) {
  if (!isFirebaseConfigured || !db) {
    localStatsListeners.push(callback);
    callback(getLocalStats());
    return () => {
      localStatsListeners = localStatsListeners.filter((fn) => fn !== callback);
    };
  }

  const ref = doc(db, STATS_DOC_PATH, STATS_DOC_ID);

  return onSnapshot(
    ref,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback({ confirmedPeople: 0 });
        return;
      }
      const data = snapshot.data();
      const stats: EventStats = {
        confirmedPeople: Math.max(0, Number(data.confirmedPeople || 0)),
        confirmedGuests: typeof data.confirmedGuests === 'number' ? data.confirmedGuests : undefined,
        declinedGuests: typeof data.declinedGuests === 'number' ? data.declinedGuests : undefined,
        updatedAt: data.updatedAt,
      };
      saveLocalStats(stats);
      callback(stats);
    },
    (err) => {
      console.warn('Error reading eventStats:', err);
      callback(getLocalStats());
    }
  );
}

export async function incrementConfirmedAttendees(count: number): Promise<void> {
  if (count <= 0) return;

  const currentLocal = getLocalStats();
  saveLocalStats({
    ...currentLocal,
    confirmedPeople: currentLocal.confirmedPeople + count,
  });

  if (!isFirebaseConfigured || !db) {
    return;
  }

  const ref = doc(db, STATS_DOC_PATH, STATS_DOC_ID);
  try {
    await updateDoc(ref, {
      confirmedPeople: increment(count),
      updatedAt: serverTimestamp(),
    });
  } catch (err: any) {
    // If doc does not exist yet, initialize it
    if (err?.code === 'not-found' || err?.message?.includes('No document to update')) {
      await setDoc(ref, {
        confirmedPeople: count,
        updatedAt: serverTimestamp(),
      });
    } else {
      console.warn('Could not increment eventStats:', err);
    }
  }
}
