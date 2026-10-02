import React, { useState, useEffect } from 'react';
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
import { AdminDashboard } from './components/Admin/AdminDashboard';
import { Gift, Guest, GiftReservation, EventSettings } from './types';
import { DEFAULT_SETTINGS, INITIAL_GIFTS } from './data/defaultData';
import { subscribeSettings } from './services/settingsService';
import { subscribeGifts } from './services/giftService';
import { subscribeGuests } from './services/guestService';
import { subscribeReservations } from './services/giftService';

export default function App() {
  const [settings, setSettings] = useState<EventSettings>(DEFAULT_SETTINGS);
  const [gifts, setGifts] = useState<Gift[]>(
    INITIAL_GIFTS.map((g, i) => ({ ...g, id: `seed-${i + 1}` }))
  );
  const [guests, setGuests] = useState<Guest[]>([]);
  const [reservations, setReservations] = useState<GiftReservation[]>([]);

  // Modals state
  const [selectedGift, setSelectedGift] = useState<Gift | null>(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  // Check admin session on load
  useEffect(() => {
    const isLogged = localStorage.getItem('alyne_admin_logged_in') === 'true';
    setIsAdminLoggedIn(isLogged);
  }, []);

  // Listeners
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

    const unsubReservations = subscribeReservations((newReservations) => {
      setReservations(newReservations);
    });

    return () => {
      unsubSettings();
      unsubGifts();
      unsubGuests();
      unsubReservations();
    };
  }, []);

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

  const handleLogout = () => {
    localStorage.removeItem('alyne_admin_logged_in');
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
        <RsvpSection guests={guests} />

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
        <AdminDashboard
          gifts={gifts}
          guests={guests}
          reservations={reservations}
          settings={settings}
          onClose={() => setIsAdminDashboardOpen(false)}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
