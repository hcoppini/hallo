'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { BarmanDisplay } from '@/components/BarmanDisplay';
import { QuickSearchModal } from '@/components/QuickSearchModal';
import { AdminPinModal } from '@/components/AdminPinModal';
import { SpeedKeypad } from '@/components/SpeedKeypad';
import { StationLockScreen } from '@/components/StationLockScreen';
import { usePartyStore } from '@/lib/store';
import { DrinkType, Guest, BAR_DRINKS } from '@/lib/types';
import { isWebNfcSupported, nfcController } from '@/lib/nfc';
import { findGuestByTag, parseTagId } from '@/lib/tag-utils';
import { calculateEffectiveLimit } from '@/lib/party-engine';
import {
  useStaffAuth,
  setStaffActiveDrinkType,
  getStaffActiveDrinkType,
  setStaffStationMode,
} from '@/lib/auth';
import { subscribeToTagRelay, sendTagRelayMessage } from '@/lib/tag-relay';
import { Hash, Search, Users, X, Keyboard } from 'lucide-react';

const DRINK_KEY_MAP: Record<string, DrinkType> = {
  '1': 'beer',
  '2': 'whiskey sour',
  '3': 'mojito',
  '4': 'jagerbomba',
  '5': 'cosmopolitan',
  '6': 'red wine',
  '7': 'sparkling wine',
  '8': 'soft',
};

export default function BarmanPage() {
  const {
    guests,
    logs,
    settings,
    menu,
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
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);
  const [relayFlash, setRelayFlash] = useState<string | null>(null);
  const [dockFilter, setDockFilter] = useState('');

  const [selectedDrinkType, setSelectedDrinkType] = useState<DrinkType>(() => {
    const saved = getStaffActiveDrinkType();
    const isValidSpecific = BAR_DRINKS.some(d => d.type === saved) || saved === 'soft';
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
      .sort(
        (a, b) =>
          new Date(b.entered_at || 0).getTime() - new Date(a.entered_at || 0).getTime()
      );

    return enteredGuests[0] || null;
  }, [selectedGuestId, guests, logs]);

  // Checked-in guests for the Desktop Right Dock quick-switcher
  const checkedInGuests = useMemo(() => {
    const q = dockFilter.trim().toLowerCase();
    const activeList = guests
      .filter(g => g.is_entered || (g.name && g.name.trim().length > 0))
      .sort((a, b) => {
        const numA = parseTagId(a.tag_id).tagNumber ?? 999;
        const numB = parseTagId(b.tag_id).tagNumber ?? 999;
        return numA - numB;
      });

    if (!q) return activeList;
    return activeList.filter(
      g =>
        (g.name || '').toLowerCase().includes(q) ||
        g.tag_id.toLowerCase().includes(q) ||
        String(parseTagId(g.tag_id).tagNumber ?? '').includes(q)
    );
  }, [guests, dockFilter]);

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

  // Listen to real-time NFC Tag Relay
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

  const handleDrinkTypeChange = useCallback((type: DrinkType) => {
    setSelectedDrinkType(type);
    setStaffActiveDrinkType(type);
  }, []);

  const handleManualServe = useCallback(
    async (tagId: string, drinkType: DrinkType) => {
      await serveDrink(tagId, drinkType);
    },
    [serveDrink]
  );

  // Global physical keyboard shortcuts on laptop:
  // [1-7] Select drink type
  // [Enter] Serve active drink
  // [Esc] Deselect customer
  // [/] or [Ctrl/Cmd+K] Search guest
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (isInputFocused) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      } else if (e.key === '/' && !isSearchOpen && !isPinModalOpen) {
        e.preventDefault();
        setIsSearchOpen(true);
      } else if (e.key === 'Escape') {
        setSelectedGuestId(null);
      } else if (/^[1-9]$/.test(e.key)) {
        const keyIdx = parseInt(e.key, 10) - 1;
        const available = menu.filter(m => m.is_available);
        if (available[keyIdx]) {
          e.preventDefault();
          handleDrinkTypeChange(available[keyIdx].type as DrinkType);
        } else if (e.key in DRINK_KEY_MAP) {
          e.preventDefault();
          handleDrinkTypeChange(DRINK_KEY_MAP[e.key]);
        }
      } else if (e.key === 'Enter' && activeGuest && !isSearchOpen && !isPinModalOpen) {
        const curLimit = calculateEffectiveLimit(activeGuest, settings);
        const isAtLimit =
          activeGuest.category !== 'vip' && activeGuest.drinks_consumed >= curLimit;
        if (!isAtLimit) {
          e.preventDefault();
          handleManualServe(activeGuest.tag_id, selectedDrinkType);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isAuthenticated,
    isSearchOpen,
    isPinModalOpen,
    activeGuest,
    selectedDrinkType,
    settings,
    handleDrinkTypeChange,
    handleManualServe,
    setIsSearchOpen,
    setSelectedGuestId,
  ]);

  // Handle incoming redirect from /t/[id]?tag=...
  useEffect(() => {
    if (typeof window !== 'undefined' && isAuthenticated) {
      const params = new URLSearchParams(window.location.search);
      const tagParam = params.get('tag') || params.get('served');
      if (tagParam) {
        handleSelectTag(decodeURIComponent(tagParam).toUpperCase());
      }
    }
  }, [isAuthenticated, handleSelectTag]);

  const handleSelectFromSearch = (guest: Guest) => {
    setSelectedGuestId(guest.id);
  };

  // If not authenticated, show professional StationLockScreen with immediate keyboard typing
  if (!isAuthenticated) {
    return (
      <StationLockScreen
        stationTitle="barman station"
        stationSubtitle="enter 4-digit staff pin to unlock bar desk terminal"
        stationBadge="STAFF POS TERMINAL"
      />
    );
  }

  return (
    <div className="w-full py-4 lg:py-6 space-y-4 lg:space-y-6 animate-in fade-in duration-150">
      {relayFlash && (
        <div className="p-3 rounded-2xl bg-emerald-600 text-white text-xs font-sans-clean font-bold text-center shadow-lg animate-in fade-in duration-150">
          ⚡ {relayFlash}
        </div>
      )}

      {/* Mobile & Tablet Compact Fast Bar Toolbar (< lg) */}
      <div className="lg:hidden flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-black/[0.04] border border-black/10">
        <button
          type="button"
          onClick={() => setIsKeypadOpen(prev => !prev)}
          className={`flex-1 py-2.5 px-3 rounded-xl font-sans-clean text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            isKeypadOpen
              ? 'bg-black text-white shadow-sm'
              : 'bg-white text-black border border-black/12 hover:border-black/30'
          }`}
        >
          <Hash className="w-3.5 h-3.5" />
          <span>{isKeypadOpen ? 'hide # keypad' : 'type wristband # (1–100)'}</span>
        </button>

        <button
          type="button"
          onClick={() => setIsSearchOpen(true)}
          className="flex-1 py-2.5 px-3 rounded-xl bg-white text-black border border-black/12 hover:border-black/30 font-sans-clean text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          <Search className="w-3.5 h-3.5" />
          <span>search guest name</span>
        </button>
      </div>

      {/* Collapsible Mobile SpeedKeypad (< lg) */}
      {isKeypadOpen && (
        <div className="lg:hidden animate-in fade-in duration-150">
          <SpeedKeypad
            selectedDrinkType={selectedDrinkType}
            onSelectGuest={guest => {
              handleSelectFromSearch(guest);
              setIsKeypadOpen(false);
            }}
            onServe={async (tagId, drinkType) => {
              await handleManualServe(tagId, drinkType);
              setIsKeypadOpen(false);
            }}
          />
        </div>
      )}

      {/* Responsive POS Grid: 12-Col Split Workspace on Laptop (lg+) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left / Primary POS Workspace (7 cols on lg, 8 cols on xl) */}
        <div className="lg:col-span-7 xl:col-span-8">
          <BarmanDisplay
            activeGuest={activeGuest}
            selectedDrinkType={selectedDrinkType}
            onDrinkTypeChange={handleDrinkTypeChange}
            onManualServe={handleManualServe}
            onOpenSearch={() => setIsSearchOpen(true)}
            onClearCustomer={() => setSelectedGuestId(null)}
          />
        </div>

        {/* Right / Persistent Desktop POS Side Dock (5 cols on lg, 4 cols on xl) */}
        <aside className="hidden lg:flex lg:col-span-5 xl:col-span-4 flex-col gap-5 lg:sticky lg:top-24">
          {/* Dock Card 1: Always-Ready Speed Keypad with Physical Keyboard Support */}
          <SpeedKeypad
            selectedDrinkType={selectedDrinkType}
            enableKeyboardShortcuts={!isSearchOpen && !isPinModalOpen}
            onSelectGuest={handleSelectFromSearch}
            onServe={async (tagId, drinkType) => {
              await handleManualServe(tagId, drinkType);
            }}
          />

          {/* Dock Card 2: Checked-In Guests Quick Roster */}
          <div className="glass-card p-5 border border-black/12 shadow-md space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-black/60" />
                <h3 className="font-display text-xl font-bold lowercase text-black leading-none">
                  checked-in guests
                </h3>
              </div>
              <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full bg-black/6 text-black/70">
                {checkedInGuests.length} in
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-black/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter roster by name or #..."
                value={dockFilter}
                onChange={e => setDockFilter(e.target.value)}
                className="w-full pl-8 pr-7 py-2 bg-black/[0.035] border border-black/12 rounded-xl font-sans-clean text-xs text-black placeholder:text-black/35 outline-none focus:bg-white focus:border-black transition-colors"
              />
              {dockFilter && (
                <button
                  type="button"
                  onClick={() => setDockFilter('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-black/40 hover:text-black"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 no-scrollbar">
              {checkedInGuests.length === 0 ? (
                <p className="text-center py-6 text-xs font-sans-clean text-black/40 lowercase">
                  no matching checked-in guests
                </p>
              ) : (
                checkedInGuests.map(guest => {
                  const isCurrent = activeGuest?.id === guest.id;
                  const limit = calculateEffectiveLimit(guest, settings);
                  const isAtLimit =
                    guest.category !== 'vip' && guest.drinks_consumed >= limit;
                  const slotNum = parseTagId(guest.tag_id).tagNumber ?? guest.tag_id;

                  return (
                    <button
                      key={guest.id}
                      type="button"
                      onClick={() => handleSelectFromSearch(guest)}
                      className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                        isCurrent
                          ? 'bg-black text-white border-black shadow-xs'
                          : 'bg-white hover:bg-black/[0.03] text-black border-black/8 hover:border-black/25'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            isCurrent
                              ? 'bg-white/20 text-white'
                              : 'bg-black/6 text-black/70'
                          }`}
                        >
                          #{slotNum}
                        </span>
                        <span className="font-sans-clean text-xs font-bold truncate">
                          {guest.name || guest.tag_id}
                        </span>
                      </div>

                      <span
                        className={`font-mono text-xs font-bold shrink-0 ${
                          isCurrent
                            ? 'text-white'
                            : isAtLimit
                            ? 'text-red-600'
                            : 'text-black/65'
                        }`}
                      >
                        {guest.drinks_consumed}/
                        {guest.category === 'vip' ? '∞' : limit}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Dock Card 3: Desktop POS Keyboard Shortcuts Cheatsheet */}
          <div className="p-4 rounded-2xl bg-black/[0.03] border border-black/10 text-xs font-sans-clean space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-black text-[11px] uppercase tracking-wider">
              <Keyboard className="w-3.5 h-3.5 text-black/60" />
              <span>POS Keyboard Shortcuts</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px] text-black/65 font-mono">
              <div className="flex justify-between">
                <span>[0-9]</span>
                <span className="text-black font-sans-clean font-semibold">dial tag</span>
              </div>
              <div className="flex justify-between">
                <span>[1-7]</span>
                <span className="text-black font-sans-clean font-semibold">pick drink</span>
              </div>
              <div className="flex justify-between">
                <span>[Enter]</span>
                <span className="text-black font-sans-clean font-semibold">serve drink</span>
              </div>
              <div className="flex justify-between">
                <span>[/]</span>
                <span className="text-black font-sans-clean font-semibold">search</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Manual Search Modal */}
      <QuickSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectGuest={handleSelectFromSearch}
      />
    </div>
  );
}
