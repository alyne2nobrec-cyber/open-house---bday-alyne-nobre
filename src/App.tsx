import React, { useState, useEffect, Suspense, lazy } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { EventStory } from './components/EventStory';
import { GiftRegistry } from './components/GiftRegistry';
import { GiftReserveModal } from './components/GiftReserveModal';
import { RsvpSection } from './components/RsvpSection';
import { HouseGallery } from './components/HouseGallery';
import { LocationDetails } from './components/LocationDetails';
import { ShareBar } from './components/ShareBar';
import { Footer } from './components/Footer';
import { AdminLoginModal } from './components/Admin/AdminLoginModal';
import { Gift, Guest, GiftReservation, EventSettings } from './types';
import { DEFAULT_SETTINGS, INITIAL_GIFTS } from './data/defaultData';
import { subscribeSettings } from './services/settingsService';
import { subscribeGifts } from './services/giftService';
import { subscribeGuests } from './services/guestService';
import { subscribeReservations } from './services/giftService';
import { auth } from './lib/firebase';

const AdminDashboard = lazy(() => import('./components/Admin/AdminDashboard').then((module) => ({ default: module.AdminDashboard })));

const ADMIN_ALLOWED_EMAILS = [
  'alyne.custodio@dux-company.com',
  'alyne2.nobre.c@gmail.com',
];

export function normalizeAdminEmail(value?: string | null): string {
  return (value || '').trim().replace(/^['"]+|['"]+$/g, '').toLowerCase();
}

export function isAdminEmail(email?: string | null): boolean {
  const normalized = normalizeAdminEmail(email);
  const envAdmin = normalizeAdminEmail(import.meta.env.VITE_ADMIN_EMAIL);
  const allowed = new Set([envAdmin, ...ADMIN_ALLOWED_EMAILS]);
  return Boolean(normalized && allowed.has(normalized));
}

export default function App() {
  const [settings, setSettings] = useState<EventSettings>(DEFAULT_SETTINGS);
  const [gifts, setGifts] = useState<Gift[]>(
    INITIAL_GIFTS.map((g, i) => ({ ...g, id: `seed-${i + 1}` }))
  );
  const [guests, setGuests] = useState<Guest[]>([]);
  const [reservations, setReservations] = useState<GiftReservation[]>([]);

  const [selectedGift, setSelectedGift] = useState<Gift | null>(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [authSessionLoading, setAuthSessionLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setIsAdminLoggedIn(false);
      setIsAdminDashboardOpen(false);
      setAuthSessionLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const allowed = isAdminEmail(user?.email || null);
      setIsAdminLoggedIn(allowed);
      setAuthSessionLoading(false);
      if (!allowed) {
        setIsAdminDashboardOpen(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubSettings = subscribeSettings((newSettings) => {
      setSettings(newSettings);
    });

    const unsubGifts = subscribeGifts((newGifts) => {
      setGifts(newGifts);
    });

    const unsubGuests = subscribeGuests((newGuests) => {
      setGuests(newGuests);
    });

    let unsubReservations = () => {};

    if (isAdminLoggedIn && !authSessionLoading) {
      unsubReservations = subscribeReservations((newReservations) => {
        setReservations(newReservations);
      });
    } else {
      setReservations([]);
    }

    return () => {
      unsubSettings();
      unsubGifts();
      unsubGuests();
      unsubReservations();
    };
  }, [isAdminLoggedIn, authSessionLoading]);

  const handleScrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleOpenAdmin = () => {
    if (isAdminLoggedIn) {
      setIsAdminDashboardOpen(true);
    } else {
      setIsAdminModalOpen(true);
    }
  };

  const handleLoginSuccess = () => {
    setIsAdminLoggedIn(true);
    setIsAdminDashboardOpen(true);
  };

  const handleLogout = async () => {
    try {
      if (auth) {
        await signOut(auth);
      }
    } catch {}
    setIsAdminLoggedIn(false);
    setIsAdminDashboardOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#2D2A26] flex flex-col font-sans">
      {/* Top Bar Navigation */}
      <Navbar onOpenAdmin={handleOpenAdmin} isAdmin={isAdminLoggedIn} />

      {/* Main Content */}
      <main className="flex-1">
        {/* 1. Hero Section with countdown, host photo and CTAs */}
        <Hero settings={settings} onScrollTo={handleScrollTo} />

        {/* 2. Story Section with celebration concept */}
        <EventStory />

        {/* 3. Intelligent Gift Registry */}
        <GiftRegistry gifts={gifts} onSelectGift={(gift) => setSelectedGift(gift)} />

        {/* 4. RSVP Section ("Vossa Ilustríssima Presença") */}
        <RsvpSection guests={guests} settings={settings} />

        {/* 5. House Gallery (Virtual Tour of New Home) */}
        <HouseGallery settings={settings} />

        {/* 6. Location Details & Map Coordinates */}
        <LocationDetails settings={settings} />

        {/* 7. Share bar for WhatsApp and Web Share */}
        <ShareBar />
      </main>

      {/* Footer */}
      <Footer
        settings={settings}
        onOpenAdmin={handleOpenAdmin}
        isAdmin={isAdminLoggedIn}
      />

      {/* Gift Reservation Modal */}
      {selectedGift && (
        <GiftReserveModal
          gift={selectedGift}
          settings={settings}
          onClose={() => setSelectedGift(null)}
          onSuccess={() => {
            // Keep open to show confirmation and QR Code / links
          }}
        />
      )}

      {/* Admin Login Modal */}
      <AdminLoginModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Admin Full Dashboard */}
      {isAdminDashboardOpen && (
        <Suspense fallback={<div className="fixed inset-0 z-50 bg-black/30" /> }>
          <AdminDashboard
            gifts={gifts}
            guests={guests}
            reservations={reservations}
            settings={settings}
            onClose={() => setIsAdminDashboardOpen(false)}
            onLogout={handleLogout}
          />
        </Suspense>
      )}
    </div>
  );
}
