'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { BarmanDisplay } from '@/components/BarmanDisplay';
import { QuickSearchModal } from '@/components/QuickSearchModal';
import { AdminPinModal } from '@/components/AdminPinModal';
import { usePartyStore } from '@/lib/store';
import { DrinkType, Guest, BAR_DRINKS } from '@/lib/types';
import { isWebNfcSupported, nfcController } from '@/lib/nfc';
import { findGuestByTag } from '@/lib/tag-utils';
import {
  useStaffAuth,
  setStaffActiveDrinkType,
  getStaffActiveDrinkType,
  setStaffStationMode,
} from '@/lib/auth';
import { subscribeToTagRelay, sendTagRelayMessage } from '@/lib/tag-relay';
import { Lock } from 'lucide-react';

export default function BarmanPage() {
  const {
    guests,
    logs,
    selectedGuestId,
    setSelectedGuestId,
    isSearchOpen,
    setIsSearchOpen,
    serveDrink,
    fetchGuestByTag,
    refresh,
  } = usePartyStore();
  const { isAuthenticated } = useStaffAuth();
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [relayFlash, setRelayFlash] = useState<string | null>(null);

  const [selectedDrinkType, setSelectedDrinkType] = useState<DrinkType>(() => {
    const saved = getStaffActiveDrinkType();
    const isValidSpecific = BAR_DRINKS.some(d => d.type === saved);
    return isValidSpecific ? (saved as DrinkType) : 'beer';
  });

  const selectedDrinkRef = useRef<DrinkType>(selectedDrinkType);
  useEffect(() => {
    selectedDrinkRef.current = selectedDrinkType;
  }, [selectedDrinkType]);

  // Resolve active customer: explicit selection -> latest log guest -> most recently checked-in guest
  const activeGuest = useMemo<Guest | null>(() => {
    if (selectedGuestId) {
      const found = guests.find(g => g.id === selectedGuestId);
      if (found) return found;
    }

    const latestLog = logs.find(l => !l.is_reverted);
    if (latestLog) {
      const logGuest = guests.find(g => g.id === latestLog.guest_id);
      if (logGuest) return logGuest;
    }

    const enteredGuests = guests
      .filter(g => g.is_entered)
      .sort((a, b) => new Date(b.entered_at || 0).getTime() - new Date(a.entered_at || 0).getTime());

    return enteredGuests[0] || null;
  }, [selectedGuestId, guests, logs]);

  const handleSelectTag = useCallback(
    async (tagId: string, hardwareUid?: string) => {
      const targetTag = tagId || hardwareUid || '';
      if (!targetTag) return;

      let matched = findGuestByTag(guests, targetTag);
      if (!matched) {
        matched = (await fetchGuestByTag(targetTag)) || undefined;
      }
      if (matched) {
        setSelectedGuestId(matched.id);
      }
    },
    [guests, fetchGuestByTag, setSelectedGuestId]
  );

  // Auto-acquire wake lock and background NFC listener on barman desk
  useEffect(() => {
    if (isAuthenticated) {
      setStaffStationMode('barman');
      nfcController.requestWakeLock();
      if (isWebNfcSupported() && !nfcController.getScanningState()) {
        nfcController.startScan((tagId, hardwareUid) => {
          handleSelectTag(tagId, hardwareUid);
        });
      }
    }
    return () => {
      nfcController.releaseWakeLock();
    };
  }, [isAuthenticated, handleSelectTag]);

  // Listen to real-time NFC Tag Relay (from /t/[id] tabs or cross-device taps)
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribe = subscribeToTagRelay(msg => {
      if (msg.type === 'PING_STATION') {
        sendTagRelayMessage({
          type: 'STATION_ACK',
          station: 'barman',
          drinkType: selectedDrinkRef.current,
        });
      } else if (msg.type === 'DRINK_SERVED' && msg.result) {
        if (msg.result.guest?.id) {
          setSelectedGuestId(msg.result.guest.id);
        } else if (msg.tagId) {
          handleSelectTag(msg.tagId);
        }
        setRelayFlash(`Relayed NFC tap: ${msg.result.guest?.name || msg.tagId}`);
        refresh();
        setTimeout(() => setRelayFlash(null), 3500);
      } else if (msg.type === 'TAG_TAPPED' && msg.tagId) {
        handleSelectTag(msg.tagId);
        if (msg.isAssigned === false) {
          setRelayFlash(`Unassigned wristband tapped: ${msg.tagId}`);
          setTimeout(() => setRelayFlash(null), 4000);
        }
      }
    });

    return () => unsubscribe();
  }, [isAuthenticated, refresh, handleSelectTag, setSelectedGuestId]);

  // Sync drink type changes with staff session storage
  const handleDrinkTypeChange = (type: DrinkType) => {
    setSelectedDrinkType(type);
    setStaffActiveDrinkType(type);
  };

  // Handle incoming redirect from /t/[id]?tag=... by selecting the customer
  useEffect(() => {
    if (typeof window !== 'undefined' && isAuthenticated) {
      const params = new URLSearchParams(window.location.search);
      const tagParam = params.get('tag') || params.get('served');
      if (tagParam) {
        handleSelectTag(decodeURIComponent(tagParam).toUpperCase());
      }
    }
  }, [isAuthenticated, handleSelectTag]);

  const handleManualServe = async (tagId: string, drinkType: DrinkType) => {
    await serveDrink(tagId, drinkType);
  };

  const handleSelectFromSearch = (guest: Guest) => {
    setSelectedGuestId(guest.id);
  };

  // If not authenticated, require the 4-digit staff PIN
  if (!isAuthenticated) {
    return (
      <div className="w-full py-12 px-4 max-w-sm mx-auto text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-black/5 flex items-center justify-center mx-auto text-black border border-black/10">
          <Lock className="w-8 h-8" />
        </div>
        <div>
          <span className="font-mono text-[10px] text-black/40 uppercase tracking-widest block mb-1">
            STAFF SECURITY LOCK
          </span>
          <h2 className="font-display text-3xl font-bold lowercase text-black">
            barman station
          </h2>
          <p className="font-sans-clean text-xs text-black/60 mt-1 max-w-xs mx-auto">
            This terminal is locked. Enter the 4-digit staff PIN to enable drink logging.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsPinModalOpen(true)}
          className="btn-premium-primary w-full py-4 text-xs gap-2"
        >
          <Lock className="w-4 h-4" />
          <span>Enter Staff PIN</span>
        </button>

        <AdminPinModal
          isOpen={isPinModalOpen}
          title="staff authorization"
          subtitle="enter 4-digit staff pin to unlock bar desk"
          onSuccess={() => setIsPinModalOpen(false)}
          onClose={() => setIsPinModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="w-full py-4 space-y-4">
      {relayFlash && (
        <div className="p-3 rounded-2xl bg-emerald-600 text-white text-xs font-sans-clean font-bold text-center shadow-lg animate-in fade-in duration-150">
          ⚡ {relayFlash}
        </div>
      )}

      <BarmanDisplay
        activeGuest={activeGuest}
        selectedDrinkType={selectedDrinkType}
        onDrinkTypeChange={handleDrinkTypeChange}
        onManualServe={handleManualServe}
        onOpenSearch={() => setIsSearchOpen(true)}
      />

      {/* Manual Search Modal */}
      <QuickSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectGuest={handleSelectFromSearch}
      />
    </div>
  );
}
