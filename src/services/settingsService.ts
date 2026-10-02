import {
  doc,
  onSnapshot,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { EventSettings } from '../types';
import { DEFAULT_SETTINGS } from '../data/defaultData';

const SETTINGS_COLLECTION = 'eventSettings';
const SETTINGS_DOC_ID = 'main';
const LOCAL_STORAGE_SETTINGS_KEY = 'alyne_settings_cache_v1';

function getLocalSettings(): EventSettings {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    console.warn('LocalStorage settings error:', e);
  }
  return DEFAULT_SETTINGS;
}

function saveLocalSettings(settings: EventSettings) {
  try {
    localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('LocalStorage save error:', e);
  }
}

export function subscribeSettings(callback: (settings: EventSettings) => void) {
  const ref = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);

  const unsubscribe = onSnapshot(
    ref,
    async (snapshot) => {
      if (!snapshot.exists()) {
        // Initialize doc in Firestore
        try {
          await setDoc(ref, {
            ...DEFAULT_SETTINGS,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          console.warn('Could not write initial settings to Firestore, using fallback:', err);
        }
        callback(getLocalSettings());
        return;
      }

      const data = snapshot.data();
      const merged: EventSettings = {
        eventName: data.eventName || DEFAULT_SETTINGS.eventName,
        hostName: data.hostName || DEFAULT_SETTINGS.hostName,
        instagramHandle: data.instagramHandle || DEFAULT_SETTINGS.instagramHandle,
        eventDate: data.eventDate || DEFAULT_SETTINGS.eventDate,
        eventTime: data.eventTime || DEFAULT_SETTINGS.eventTime,
        eventEndTime: data.eventEndTime || DEFAULT_SETTINGS.eventEndTime,
        locationName: data.locationName || DEFAULT_SETTINGS.locationName,
        locationAddress: data.locationAddress || DEFAULT_SETTINGS.locationAddress,
        locationCity: data.locationCity || DEFAULT_SETTINGS.locationCity,
        locationNotes: data.locationNotes ?? DEFAULT_SETTINGS.locationNotes,
        googleMapsUrl: data.googleMapsUrl || DEFAULT_SETTINGS.googleMapsUrl,
        heroHeading: data.heroHeading || DEFAULT_SETTINGS.heroHeading,
        heroSubheading: data.heroSubheading || DEFAULT_SETTINGS.heroSubheading,
        quote: data.quote || DEFAULT_SETTINGS.quote,
        mainImageUrl: data.mainImageUrl || DEFAULT_SETTINGS.mainImageUrl,
        pixKey: data.pixKey || DEFAULT_SETTINGS.pixKey,
        pixKeyType: data.pixKeyType || DEFAULT_SETTINGS.pixKeyType,
        pixQrCodeUrl: data.pixQrCodeUrl || DEFAULT_SETTINGS.pixQrCodeUrl,
        galleryImages: Array.isArray(data.galleryImages) && data.galleryImages.length > 0
          ? data.galleryImages
          : DEFAULT_SETTINGS.galleryImages,
      };

      saveLocalSettings(merged);
      callback(merged);
    },
    (error) => {
      console.warn('Settings subscription error:', error.message);
      callback(getLocalSettings());
    }
  );

  return unsubscribe;
}

export async function updateEventSettings(newSettings: Partial<EventSettings>): Promise<void> {
  const current = getLocalSettings();
  const updated: EventSettings = { ...current, ...newSettings };
  saveLocalSettings(updated);

  try {
    const ref = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    await setDoc(ref, {
      ...updated,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn('Error saving settings to firestore (saved locally):', err);
  }
}
