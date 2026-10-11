import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { EventSettings } from '../types';
import { DEFAULT_SETTINGS } from '../data/defaultData';

const SETTINGS_COLLECTION = 'eventSettings';
const SETTINGS_DOC_ID = 'main';

let localSettingsListeners: Array<(settings: EventSettings) => void> = [];

const bundledImageDefaults = [
  { filename: 'alyne_portrait_1790969104126', url: DEFAULT_SETTINGS.mainImageUrl },
  { filename: 'modern_living_room_1790969114799', url: DEFAULT_SETTINGS.galleryImages[0] },
  { filename: 'kitchen_dining_bar_1790969125087', url: DEFAULT_SETTINGS.galleryImages[1] },
  { filename: 'aesthetic_reading_nook_1790969135611', url: DEFAULT_SETTINGS.galleryImages[2] },
];

function getImagePath(url: string): string | null {
  try {
    return new URL(url, 'https://assets.invalid').pathname;
  } catch {
    return null;
  }
}

function isUnstableBundledImageUrl(url: string): boolean {
  const path = getImagePath(url);
  return Boolean(
    path &&
    (path.startsWith('/src/assets/') ||
      bundledImageDefaults.some((image) => path.includes(image.filename)))
  );
}

function resolveImageUrl(url: string | undefined, fallback: string): string {
  if (!url) return fallback;

  const path = getImagePath(url);
  const bundledImage = path
    ? bundledImageDefaults.find((image) => path.includes(image.filename))
    : undefined;

  if (bundledImage) return bundledImage.url;
  if (path?.startsWith('/src/assets/')) return fallback;
  return url;
}

function normalizeSettings(settings: EventSettings): EventSettings {
  const defaults = DEFAULT_SETTINGS.galleryImages;
  const galleryImages = Array.isArray(settings.galleryImages) && settings.galleryImages.length > 0
    ? settings.galleryImages.map((url, index) =>
        resolveImageUrl(url, defaults[index % defaults.length] || defaults[0])
      )
    : defaults;

  return {
    ...settings,
    mainImageUrl: resolveImageUrl(settings.mainImageUrl, DEFAULT_SETTINGS.mainImageUrl),
    galleryImages,
  };
}

function omitBundledImages<T extends Partial<EventSettings>>(settings: T): T {
  const persistable = { ...settings };
  if (persistable.mainImageUrl && isUnstableBundledImageUrl(persistable.mainImageUrl)) {
    delete persistable.mainImageUrl;
  }
  if (persistable.galleryImages?.some(isUnstableBundledImageUrl)) {
    delete persistable.galleryImages;
  }
  return persistable;
}

function getLocalSettings(): EventSettings {
  try {
    const raw = localStorage.getItem('alyne_settings_cache_v1');
    if (raw) return normalizeSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
  } catch (e) {
    console.warn('LocalStorage settings error:', e);
  }
  return DEFAULT_SETTINGS;
}

function saveLocalSettings(settings: EventSettings) {
  const normalizedSettings = normalizeSettings(settings);
  try {
    localStorage.setItem('alyne_settings_cache_v1', JSON.stringify(normalizedSettings));
    localSettingsListeners.forEach((fn) => fn(normalizedSettings));
  } catch (e) {
    console.warn('LocalStorage save error:', e);
  }
}

export function subscribeSettings(callback: (settings: EventSettings) => void) {
  if (!isFirebaseConfigured || !db) {
    localSettingsListeners.push(callback);
    callback(getLocalSettings());
    return () => {
      localSettingsListeners = localSettingsListeners.filter((fn) => fn !== callback);
    };
  }

  const ref = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);

  const unsubscribe = onSnapshot(
    ref,
    async (snapshot) => {
      if (!snapshot.exists()) {
        try {
          await setDoc(ref, {
            ...omitBundledImages(DEFAULT_SETTINGS),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          console.warn('Could not write initial settings to Firestore:', err);
        }
        callback(getLocalSettings());
        return;
      }

      const data = snapshot.data();
      const merged = normalizeSettings({
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
        shippingRecipientName: data.shippingRecipientName ?? '',
        shippingStreet: data.shippingStreet ?? '',
        shippingComplement: data.shippingComplement ?? '',
        shippingNeighborhood: data.shippingNeighborhood ?? '',
        shippingCity: data.shippingCity ?? '',
        shippingZip: data.shippingZip ?? '',
        shippingPhone: data.shippingPhone ?? '',
        shippingNotes: data.shippingNotes ?? '',
        heroHeading: data.heroHeading || DEFAULT_SETTINGS.heroHeading,
        heroSubheading: data.heroSubheading || DEFAULT_SETTINGS.heroSubheading,
        quote: data.quote || DEFAULT_SETTINGS.quote,
        mainImageUrl: data.mainImageUrl || DEFAULT_SETTINGS.mainImageUrl,
        pixKey: data.pixKey || DEFAULT_SETTINGS.pixKey,
        pixKeyType: data.pixKeyType || DEFAULT_SETTINGS.pixKeyType,
        pixReceiverName: data.pixReceiverName || DEFAULT_SETTINGS.pixReceiverName,
        pixBankName: data.pixBankName || DEFAULT_SETTINGS.pixBankName,
        pixBankLink: data.pixBankLink || DEFAULT_SETTINGS.pixBankLink,
        pixCopiaECola: data.pixCopiaECola || DEFAULT_SETTINGS.pixCopiaECola,
        pixQrCodeUrl: data.pixQrCodeUrl || DEFAULT_SETTINGS.pixQrCodeUrl,
        galleryImages: Array.isArray(data.galleryImages) && data.galleryImages.length > 0
          ? data.galleryImages
          : DEFAULT_SETTINGS.galleryImages,
      });

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
  const updatedSettings = normalizeSettings({
    ...getLocalSettings(),
    ...newSettings,
  });
  saveLocalSettings(updatedSettings);

  if (!isFirebaseConfigured || !db) {
    return;
  }

  const ref = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
  await setDoc(ref, {
    ...omitBundledImages(newSettings),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
