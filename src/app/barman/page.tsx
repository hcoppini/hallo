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
import { soundSystem } from '@/lib/audio';
import {
  useStaffAuth,
  setStaffActiveDrinkType,
  getStaffActiveDrinkType,
  setStaffStationMode,
} from '@/lib/auth';
import { subscribeToTagRelay, sendTagRelayMessage } from '@/lib/tag-relay';
import { Search, Users, X, Keyboard, RotateCcw, CheckCircle2, Zap } from 'lucide-react';

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
    updateGuest,
    refresh,
  } = usePartyStore();
  const { isAuthenticated } = useStaffAuth();
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [relayFlash, setRelayFlash] = useState<string | null>(null);
  const [unassignedTagPrompt, setUnassignedTagPrompt] = useState<string | null>(null);
  const [dockFilter, setDockFilter] = useState('');
  const dockSearchInputRef = useRef<HTMLInputElement>(null);

  // Single-drink undo state: holds ONLY the very last drink served
  const [lastServedDrink, setLastServedDrink] = useState<LastServedDrink | null>(null);
  const [undoSeconds, setUndoSeconds] = useState(0);

  // Quick serve on tap: automatically serves the active drink upon tapping NFC wristband
  const [quickServeMode, setQuickServeMode] = useState<boolean>(false);

  const toggleQuickServe = useCallback(() => {
    setQuickServeMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem('bar_quick_serve', String(next));
      } catch {}
      return next;
    });
  }, []);

  const [selectedDrinkType, setSelectedDrinkType] = useState<DrinkType>('beer');

  // Load client-only preferences after mount to prevent hydration mismatch
  useEffect(() => {
    try {
      if (localStorage.getItem('bar_quick_serve') === 'true') {
        setQuickServeMode(true);
      }
    } catch {}

    const saved = getStaffActiveDrinkType();
    const isValidSpecific = BAR_DRINKS.some(d => d.type === saved) || saved === 'soft';
    if (isValidSpecific) {
      setSelectedDrinkType(saved as DrinkType);
    }
  }, []);

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

  // Checked-in guests & unified search for the Right Dock quick-switcher
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

    const activeMatches = activeList.filter(
      g =>
        (g.name || '').toLowerCase().includes(q) ||
        g.tag_id.toLowerCase().includes(q) ||
        String(parseTagId(g.tag_id).tagNumber ?? '').includes(q)
    );

    const activeIds = new Set(activeList.map(g => g.id));
    const otherMatches = guests.filter(
      g =>
        !activeIds.has(g.id) &&
        ((g.name || '').toLowerCase().includes(q) ||
          g.tag_id.toLowerCase().includes(q) ||
          String(parseTagId(g.tag_id).tagNumber ?? '').includes(q))
    );

    return [...activeMatches, ...otherMatches];
  }, [guests, dockFilter]);

  // Serve drink handler: serves drink, keeps customer active on bar station, and sets single-drink undo
  const handleManualServe = useCallback(
    async (tagId: string, drinkType: DrinkType, guestOverride?: Guest) => {
      const currentTarget = guestOverride || activeGuest;
      const res = await serveDrink(tagId, drinkType);
      if (res.success) {
        const guestId = currentTarget?.id || res.guest_id || res.guest?.id;
        if (guestId) {
          setSelectedGuestId(guestId);
        }
        setDockFilter('');
        // Enable single-drink undo
        setLastServedDrink({
          guestId: guestId || '',
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

  const handleSelectTag = useCallback(
    async (tagId: string, hardwareUid?: string) => {
      const targetTag = tagId || hardwareUid || '';
      if (!targetTag) return;

      let matched = findGuestByTag(guests, targetTag);
      if (!matched) {
        matched = (await fetchGuestByTag(targetTag)) || undefined;
      }
      if (!matched) {
        const parsed = parseTagId(targetTag);
        if (parsed.tagNumber !== null) {
          matched = guests.find(g => {
            const p = parseTagId(g.tag_id);
            const pid = parseTagId(g.id);
            return p.tagNumber === parsed.tagNumber || pid.tagNumber === parsed.tagNumber;
          });
        }
      }

      if (matched) {
        setUnassignedTagPrompt(null);
        setDockFilter('');
        // Immediately select the guest so they appear directly on the bar station!
        setSelectedGuestId(matched.id);

        if (quickServeMode) {
          const limit = calculateEffectiveLimit(matched, settings);
          const isAtLimit = matched.category !== 'vip' && (matched.drinks_consumed ?? 0) >= limit;
          const isDriver = matched.category === 'driver_minor' && selectedDrinkRef.current !== 'soft';
          if (matched.is_blocked) {
            soundSystem.playErrorSound();
            return;
          }
          if (isDriver) {
            soundSystem.playErrorSound();
            return;
          }
          if (isAtLimit) {
            soundSystem.playLimitSound();
            return;
          }
          await handleManualServe(matched.tag_id, selectedDrinkRef.current, matched);
        } else {
          soundSystem.playApprovedSound();
        }
      } else {
        soundSystem.playWarningSound();
      }
    },
    [guests, fetchGuestByTag, setSelectedGuestId, quickServeMode, settings, handleManualServe]
  );

  const handleLinkUnassignedCard = async () => {
    if (!unassignedTagPrompt || !activeGuest) return;
    const tagToLink = unassignedTagPrompt;
    await updateGuest({
      id: activeGuest.id,
      notes: `[UID:${tagToLink}]`,
      hardware_uid: tagToLink,
    });
    setUnassignedTagPrompt(null);
    setRelayFlash(`Linked physical card ${tagToLink} to ${activeGuest.name}!`);
    refresh();
    soundSystem.playApprovedSound();
  };

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
      } else if (msg.type === 'TAG_TAPPED' && (msg.tagId || msg.rawId)) {
        handleSelectTag(msg.tagId || msg.rawId || '', msg.rawId);
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
          setDockFilter('');
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        dockSearchInputRef.current?.focus();
      } else if (e.key === '/') {
        e.preventDefault();
        dockSearchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setSelectedGuestId(null);
        setDockFilter('');
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
    setDockFilter('');
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
    <div className="w-full py-2 lg:py-3 space-y-2.5 sm:space-y-3 animate-in fade-in duration-150">
      {/* Undo Toast Notification (Displayed exclusively for the last served drink) */}
      {lastServedDrink && undoSeconds > 0 && (
        <div className="p-3 sm:p-3.5 rounded-2xl bg-stone-900 text-white shadow-xl flex items-center justify-between border border-stone-800 animate-in fade-in duration-150">
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

      {/* Terminal Hardware & Mode Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-[11px] font-semibold text-black/60 uppercase tracking-wider">
            ACR122U NFC Reader: Ready
          </span>
        </div>

        <button
          type="button"
          onClick={toggleQuickServe}
          suppressHydrationWarning
          className={`px-3 py-1.5 rounded-xl font-sans-clean text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer select-none active:scale-95 ${
            quickServeMode
              ? 'bg-amber-400 text-black shadow-md border border-amber-500/30'
              : 'bg-black/5 hover:bg-black/10 text-black/60 border border-black/10'
          }`}
          title="When ON, tapping a wristband on the reader instantly pours the active drink unless the guest is at limit"
        >
          <Zap className={`w-3.5 h-3.5 ${quickServeMode ? 'text-black fill-black' : 'text-black/40'}`} />
          <span suppressHydrationWarning>{quickServeMode ? '⚡ Tap-to-Serve: ON' : '⚡ Tap-to-Serve: OFF'}</span>
        </button>
      </div>

      {/* Responsive POS Layout: 8-Col Primary Desk + 4-Col Checked-in Roster on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-6 items-start">
        {/* Left / Primary POS Workspace (No-scroll optimized) */}
        <div className="lg:col-span-8">
          <BarmanDisplay
            activeGuest={activeGuest}
            selectedDrinkType={selectedDrinkType}
            onDrinkTypeChange={handleDrinkTypeChange}
            onManualServe={handleManualServe}
            onOpenSearch={() => dockSearchInputRef.current?.focus()}
            onClearCustomer={() => {
              setSelectedGuestId(null);
              setDockFilter('');
            }}
          />
        </div>

        {/* Right / Persistent Checked-In Guests Roster (with unified searchbar) */}
        <aside className="space-y-3 lg:col-span-4 lg:sticky lg:top-20">
          <div className="glass-card p-4 border border-black/12 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-black/60" />
                <h3 className="font-display text-lg font-bold lowercase text-black leading-none">
                  checked-in guests
                </h3>
              </div>
              <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full bg-black/6 text-black/70">
                {checkedInGuests.length} in
              </span>
            </div>

            {/* Single Compact Searchbar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-black/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={dockSearchInputRef}
                type="text"
                placeholder="Search or filter guests... [ / ]"
                value={dockFilter}
                onChange={e => setDockFilter(e.target.value)}
                className="w-full pl-8 pr-7 py-2 bg-black/[0.035] border border-black/12 rounded-xl font-sans-clean text-xs text-black placeholder:text-black/35 outline-none focus:bg-white focus:border-black transition-colors"
              />
              {dockFilter && (
                <button
                  type="button"
                  onClick={() => setDockFilter('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-black/40 hover:text-black cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="space-y-1.5 max-h-56 sm:max-h-64 lg:max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
              {checkedInGuests.length === 0 ? (
                <p className="text-center py-6 text-xs font-sans-clean text-black/40 lowercase">
                  no matching guests found
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
                      className={`w-full p-2 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
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
          <div className="hidden lg:block p-3.5 rounded-2xl bg-black/[0.03] border border-black/10 text-xs font-sans-clean space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-black text-[11px] uppercase tracking-wider">
              <Keyboard className="w-3.5 h-3.5 text-black/60" />
              <span>POS Hotkeys</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px] text-black/65 font-mono">
              <div className="flex justify-between">
                <span>[/]</span>
                <span className="text-black font-sans-clean font-semibold">search roster</span>
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
