'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { BarmanDisplay } from '@/components/BarmanDisplay';
import { QuickSearchModal } from '@/components/QuickSearchModal';
import { AdminPinModal } from '@/components/AdminPinModal';
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
import { Search, Users, X, Keyboard, RotateCcw, CheckCircle2 } from 'lucide-react';

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

interface LastServedDrink {
  guestId: string;
  guestName: string;
  tagId: string;
  logId: string;
  drinkType: DrinkType;
}

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
    revertLastDrink,
    fetchGuestByTag,
    refresh,
  } = usePartyStore();
  const { isAuthenticated } = useStaffAuth();
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [relayFlash, setRelayFlash] = useState<string | null>(null);
  const [dockFilter, setDockFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Single-drink undo state: holds ONLY the very last drink served
  const [lastServedDrink, setLastServedDrink] = useState<LastServedDrink | null>(null);
  const [undoSeconds, setUndoSeconds] = useState(0);

  const [selectedDrinkType, setSelectedDrinkType] = useState<DrinkType>(() => {
    const saved = getStaffActiveDrinkType();
    const isValidSpecific = BAR_DRINKS.some(d => d.type === saved) || saved === 'soft';
    return isValidSpecific ? (saved as DrinkType) : 'beer';
  });

  const selectedDrinkRef = useRef<DrinkType>(selectedDrinkType);
  useEffect(() => {
    selectedDrinkRef.current = selectedDrinkType;
  }, [selectedDrinkType]);

  // Undo countdown timer
  useEffect(() => {
    if (undoSeconds <= 0) return;
    const timer = setInterval(() => {
      setUndoSeconds(prev => {
        if (prev <= 1) {
          setLastServedDrink(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [undoSeconds]);

  // Resolve active customer: strictly explicit selection!
  // No fallback to random or latest guest so clear state works cleanly.
  const activeGuest = useMemo<Guest | null>(() => {
    if (!selectedGuestId) return null;
    return guests.find(g => g.id === selectedGuestId) || null;
  }, [selectedGuestId, guests]);

  // Search results for the Big Search Bar
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    return guests
      .filter(g => {
        const nameMatch = (g.name || '').toLowerCase().includes(q);
        const tagMatch = g.tag_id.toLowerCase().includes(q);
        const slotNum = String(parseTagId(g.tag_id).tagNumber ?? '');
        const slotMatch = slotNum === q || slotNum.startsWith(q);
        return nameMatch || tagMatch || slotMatch;
      })
      .slice(0, 8);
  }, [guests, searchQuery]);

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
        setSearchQuery('');
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

  // Serve drink handler: once served, IMMEDIATELY CLEAR THE BAR and set single-drink undo
  const handleManualServe = useCallback(
    async (tagId: string, drinkType: DrinkType) => {
      const currentTarget = activeGuest;
      const res = await serveDrink(tagId, drinkType);
      if (res.success) {
        // Clear bar immediately as requested
        setSelectedGuestId(null);
        setSearchQuery('');
        // Enable single-drink undo
        setLastServedDrink({
          guestId: currentTarget?.id || res.guest_id || res.guest?.id || '',
          guestName: currentTarget?.name || res.name || res.guest?.name || tagId,
          tagId: currentTarget?.tag_id || tagId,
          logId: res.log_id || '',
          drinkType,
        });
        setUndoSeconds(10);
      }
    },
    [activeGuest, serveDrink, setSelectedGuestId]
  );

  // Undo Last Drink handler
  const handleUndoLastDrink = useCallback(async () => {
    if (!lastServedDrink) return;
    await revertLastDrink(lastServedDrink.guestId, lastServedDrink.logId);
    setLastServedDrink(null);
    setUndoSeconds(0);
  }, [lastServedDrink, revertLastDrink]);

  // Global physical keyboard shortcuts:
  // [1-7] Select drink type
  // [Enter] Serve active drink
  // [Esc] Deselect customer / clear search
  // [/] or [Ctrl/Cmd+K] Focus Big Search Bar
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // CRITICAL: Stop background key listeners when Supervisor PIN modal or Search modal is open
      if (isPinModalOpen || isSearchOpen) return;

      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (isInputFocused) {
        if (e.key === 'Escape') {
          target.blur();
          setSearchQuery('');
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setSelectedGuestId(null);
        setSearchQuery('');
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
      } else if (e.key === 'Enter' && activeGuest) {
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
    menu,
    handleDrinkTypeChange,
    handleManualServe,
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
    setSearchQuery('');
    setIsSearchFocused(false);
  };

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
    <div className="w-full py-3 lg:py-6 space-y-4 lg:space-y-5 animate-in fade-in duration-150">
      {relayFlash && (
        <div className="p-3 rounded-2xl bg-emerald-600 text-white text-xs font-sans-clean font-bold text-center shadow-lg animate-in fade-in duration-150">
          ⚡ {relayFlash}
        </div>
      )}

      {/* Undo Toast Notification (Displayed exclusively for the last served drink) */}
      {lastServedDrink && undoSeconds > 0 && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-stone-900 text-white shadow-xl flex items-center justify-between border border-stone-800 animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="text-xs sm:text-sm font-sans-clean truncate">
              <span className="font-bold capitalize">{lastServedDrink.drinkType}</span> poured for{' '}
              <span className="font-semibold">{lastServedDrink.guestName}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleUndoLastDrink}
              className="px-3.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-sans-clean font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo Last Drink ({undoSeconds}s)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLastServedDrink(null);
                setUndoSeconds(0);
              }}
              className="p-1 rounded-lg text-white/50 hover:text-white"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* BIG INTEGRATED SEARCH BAR (Unified across desktop & mobile)      */}
      {/* ================================================================ */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="w-5 h-5 text-black/40 absolute left-4 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search guest by name or wristband # (e.g. 42 or Kasia)... [ / ]"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            className="w-full pl-12 pr-10 py-3.5 sm:py-4 bg-white border border-black/15 rounded-2xl font-sans-clean text-sm sm:text-base text-black placeholder:text-black/40 outline-none focus:border-black focus:ring-2 focus:ring-black/10 transition-all shadow-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 p-1 rounded-lg hover:bg-black/5 text-black/40 hover:text-black"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Live Search Results Dropdown */}
        {searchQuery.trim() && isSearchFocused && (
          <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 bg-white border border-black/15 rounded-2xl shadow-2xl overflow-hidden divide-y divide-black/8 animate-in fade-in duration-100">
            {searchResults.length === 0 ? (
              <div className="p-4 text-center text-xs font-sans-clean text-black/40">
                No matching guests found for &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              searchResults.map(guest => {
                const limit = calculateEffectiveLimit(guest, settings);
                const isAtLimit = guest.category !== 'vip' && guest.drinks_consumed >= limit;
                const slotNum = parseTagId(guest.tag_id).tagNumber ?? guest.tag_id;

                return (
                  <button
                    key={guest.id}
                    type="button"
                    onClick={() => handleSelectFromSearch(guest)}
                    className="w-full p-3 sm:p-3.5 text-left hover:bg-black/[0.03] transition-colors flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-black text-white shrink-0">
                        #{slotNum}
                      </span>
                      <span className="font-sans-clean text-sm font-bold text-black truncate">
                        {guest.name || guest.tag_id}
                      </span>
                      {guest.category === 'vip' && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          VIP
                        </span>
                      )}
                      {guest.category === 'driver_minor' && (
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          0 Alc
                        </span>
                      )}
                    </div>

                    <span
                      className={`font-mono text-xs font-bold shrink-0 ${
                        isAtLimit ? 'text-red-600' : 'text-black/60'
                      }`}
                    >
                      {guest.drinks_consumed}/{guest.category === 'vip' ? '∞' : limit}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Responsive POS Layout: 8-Col Primary Desk + 4-Col Checked-in Roster on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-start">
        {/* Left / Primary POS Workspace (SpeedKeypad completely removed) */}
        <div className="lg:col-span-8">
          <BarmanDisplay
            activeGuest={activeGuest}
            selectedDrinkType={selectedDrinkType}
            onDrinkTypeChange={handleDrinkTypeChange}
            onManualServe={handleManualServe}
            onOpenSearch={() => searchInputRef.current?.focus()}
            onClearCustomer={() => {
              setSelectedGuestId(null);
              setSearchQuery('');
            }}
          />
        </div>

        {/* Right / Persistent Checked-In Guests Roster (lg+) */}
        <aside className="space-y-4 lg:col-span-4 lg:sticky lg:top-24">
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
                placeholder="Filter roster..."
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

            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 no-scrollbar">
              {checkedInGuests.length === 0 ? (
                <p className="text-center py-6 text-xs font-sans-clean text-black/40 lowercase">
                  no matching checked-in guests
                </p>
              ) : (
                checkedInGuests.map(guest => {
                  const isCurrent = activeGuest?.id === guest.id;
                  const limit = calculateEffectiveLimit(guest, settings);
                  const isAtLimit = guest.category !== 'vip' && guest.drinks_consumed >= limit;
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
                            isCurrent ? 'bg-white/20 text-white' : 'bg-black/6 text-black/70'
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
                        {guest.drinks_consumed}/{guest.category === 'vip' ? '∞' : limit}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Desktop POS Keyboard Shortcuts Cheatsheet */}
          <div className="hidden lg:block p-4 rounded-2xl bg-black/[0.03] border border-black/10 text-xs font-sans-clean space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-black text-[11px] uppercase tracking-wider">
              <Keyboard className="w-3.5 h-3.5 text-black/60" />
              <span>POS Hotkeys</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px] text-black/65 font-mono">
              <div className="flex justify-between">
                <span>[/]</span>
                <span className="text-black font-sans-clean font-semibold">big search</span>
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
                <span>[Esc]</span>
                <span className="text-black font-sans-clean font-semibold">clear bar</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Manual Search Modal (Hotkey fallback) */}
      <QuickSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectGuest={handleSelectFromSearch}
      />
    </div>
  );
}
