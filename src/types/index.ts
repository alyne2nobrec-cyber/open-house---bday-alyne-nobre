export type GiftCategory = 'todos' | 'casa' | 'cozinha' | 'sala' | 'quarto' | 'banheiro' | 'pix' | 'outros';

export type GiftType = 'product' | 'pix' | 'shares' | 'external' | 'other';

export type GiftStatus = 'available' | 'unavailable' | 'sold_out';

export interface Gift {
  id: string;
  name: string;
  description: string;
  category: GiftCategory;
  imageUrl: string;
  type: GiftType;
  price: number;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  purchaseUrl?: string;
  pixKey?: string;
  pixQrCodeUrl?: string;
  status: GiftStatus;
  createdAt?: any;
  updatedAt?: any;
}

export interface GiftReservation {
  id: string;
  giftId: string;
  giftName: string;
  guestName: string;
  guestWhatsapp: string;
  quantity: number;
  message?: string;
  createdAt?: any;
}

export type GuestStatus = 'confirmed' | 'declined';

export interface Guest {
  id: string;
  name: string;
  whatsapp: string;
  attendees: number;
  companions: string[];
  status: GuestStatus;
  notes?: string;
  createdAt?: any;
}

export interface EventSettings {
  eventName: string;
  hostName: string;
  instagramHandle: string;
  eventDate: string; // e.g. "2026-11-14"
  eventTime: string; // e.g. "17:00"
  eventEndTime?: string; // e.g. "23:30"
  locationName: string;
  locationAddress: string;
  locationCity: string;
  locationNotes?: string;
  googleMapsUrl?: string;
  heroHeading: string;
  heroSubheading: string;
  quote: string;
  mainImageUrl: string;
  pixKey: string;
  pixKeyType: string;
  pixQrCodeUrl?: string;
  galleryImages: string[];
}
