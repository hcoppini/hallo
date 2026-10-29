'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePartyStore } from '@/lib/store';
import { Guest, ImportedGuest } from '@/lib/types';
import {
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Search,
  Edit3,
  X,
  Smartphone,
  Users,
  Radio,
  DoorOpen,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  parseTagId,
  getNextFreeTagId,
  isUniversalOnboardingTag,
  stripUidFromNotes,
  findRegisteredGuestByTag,
} from '@/lib/tag-utils';
import { soundSystem } from '@/lib/audio';
import { useStaffAuth, setStaffStationMode } from '@/lib/auth';
import { subscribeToTagRelay, sendTagRelayMessage } from '@/lib/tag-relay';
import { StationLockScreen } from '@/components/StationLockScreen';
import { GuestOnboardingCard } from '@/components/GuestOnboardingCard';
import { NfcWriterModal } from '@/components/NfcWriterModal';

export default function DoorCheckInPage() {
  const router = useRouter();
  const { guests, checkIn, settings, importedGuests } = usePartyStore();
  const { isAuthenticated } = useStaffAuth();
  const [isBatchEncoderOpen, setIsBatchEncoderOpen] = useState(false);
  const [selectedRosterGuest, setSelectedRosterGuest] = useState<ImportedGuest | null>(null);
  const [activeTab, setActiveTab] = useState<'expected' | 'admitted'>(() => {
    return importedGuests && importedGuests.length > 0 ? 'expected' : 'admitted';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'vip' | 'driver' | 'standard'>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const nextFreeTag = useMemo(() => getNextFreeTagId(guests), [guests]);
  const [selectedTagId, setSelectedTagId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlTag = params.get('tag');
      if (urlTag && !isUniversalOnboardingTag(urlTag)) {
        const parsed = parseTagId(urlTag);
        return parsed.canonicalTag || decodeURIComponent(urlTag).toUpperCase();
      }
    }
    return '';
  });
  const [lastAdmittedGuest, setLastAdmittedGuest] = useState<Guest | null>(null);
  const [relayedTagNotice, setRelayedTagNotice] = useState<string | null>(null);

  const effectiveTargetTag = useMemo(() => {
    if (!selectedTagId || isUniversalOnboardingTag(selectedTagId)) {
      return nextFreeTag;
    }
    return selectedTagId;
  }, [selectedTagId, nextFreeTag]);

  // Sync selected tag if URL query parameters change (without disruptive unregistered popup)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const urlTag = params.get('tag');
      if (urlTag && !isUniversalOnboardingTag(urlTag)) {
        const parsed = parseTagId(urlTag);
        const canonical = parsed.canonicalTag || decodeURIComponent(urlTag).toUpperCase();
        setSelectedTagId(canonical);
      }
    };
    syncFromUrl();
  }, []);

  // Mark staff phone in 'door' station mode
  useEffect(() => {
    if (isAuthenticated) {
      setStaffStationMode('door');
    }
  }, [isAuthenticated]);

  // Listen for NFC taps relayed from /t/[id] tabs or local ACR122U bridge
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribe = subscribeToTagRelay(msg => {
      if (msg.type === 'PING_STATION') {
        sendTagRelayMessage({
          type: 'STATION_ACK',
          station: 'door',
        });
      } else if (msg.type === 'TAG_TAPPED' && (msg.tagId || msg.rawId)) {
        const rawTag = msg.tagId || msg.rawId || '';
        if (isUniversalOnboardingTag(rawTag)) return;

        const parsed = parseTagId(rawTag);
        const canonical = parsed.canonicalTag || rawTag.toUpperCase();

        const registered =
          findRegisteredGuestByTag(guests, canonical) ||
          (msg.rawId ? findRegisteredGuestByTag(guests, msg.rawId) : undefined) ||
          (msg.hardwareUid ? findRegisteredGuestByTag(guests, msg.hardwareUid) : undefined);

        const slotNum =
          parsed.tagNumber !== null
            ? parsed.tagNumber
            : registered
            ? parseTagId(registered.tag_id).tagNumber
            : null;
        const slotText = slotNum !== null ? `#${slotNum}` : canonical;

        if (registered) {
          soundSystem.playApprovedSound();
          setLastAdmittedGuest(registered);
          setRelayedTagNotice(`Wristband ${slotText} is already registered to ${registered.name}!`);
          setTimeout(() => setRelayedTagNotice(null), 5000);
        } else {
          // Unregistered tag: seamlessly load into registration form with zero annoying popups
          setSelectedTagId(canonical);
          soundSystem.playApprovedSound();
          setRelayedTagNotice(null);
        }
      }
    });

    return () => unsubscribe();
  }, [isAuthenticated, guests]);

  const admittedGuests = useMemo(
    () =>
      guests
        .filter(g => g.is_entered && g.name)
        .sort(
          (a, b) =>
            new Date(b.entered_at || 0).getTime() - new Date(a.entered_at || 0).getTime()
        ),
    [guests]
  );

  const pendingExpectedGuests = useMemo(() => {
    return (importedGuests || []).filter(g => !g.is_checked_in);
  }, [importedGuests]);

  const filteredAdmittedGuests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return admittedGuests.filter(g => {
      if (categoryFilter === 'vip' && g.category !== 'vip') return false;
      if (categoryFilter === 'driver' && g.category !== 'driver_minor') return false;
      if (categoryFilter === 'standard' && g.category && g.category !== 'standard') return false;

      if (!q) return true;
      return (
        (g.name || '').toLowerCase().includes(q) ||
        g.tag_id.toLowerCase().includes(q) ||
        (g.notes || '').toLowerCase().includes(q)
      );
    });
  }, [admittedGuests, searchQuery, categoryFilter]);

  const filteredPendingExpectedGuests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return pendingExpectedGuests.filter(g => {
      if (categoryFilter === 'vip' && g.category !== 'vip') return false;
      if (categoryFilter === 'driver' && g.category !== 'driver_minor') return false;
      if (categoryFilter === 'standard' && g.category && g.category !== 'standard') return false;

      if (!q) return true;
      return g.name.toLowerCase().includes(q) || (g.notes || '').toLowerCase().includes(q);
    });
  }, [pendingExpectedGuests, searchQuery, categoryFilter]);

  const totalCapacity = guests.length || 100;
  const admittedCount = admittedGuests.length;
  const availableSlots = Math.max(0, totalCapacity - admittedCount);
  const capacityPercent = Math.min(100, Math.round((admittedCount / totalCapacity) * 100));

  const vipCount = useMemo(
    () => admittedGuests.filter(g => g.category === 'vip').length,
    [admittedGuests]
  );
  const driverCount = useMemo(
    () => admittedGuests.filter(g => g.category === 'driver_minor').length,
    [admittedGuests]
  );
  const standardCount = useMemo(
    () => admittedGuests.filter(g => !g.category || g.category === 'standard').length,
    [admittedGuests]
  );

  const formatEntryTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    soundSystem.playApprovedSound();
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const handleOnboardingComplete = (admittedGuest: Guest) => {
    confetti({
      particleCount: 45,
      spread: 60,
      origin: { y: 0.65 },
    });

    setLastAdmittedGuest(admittedGuest);
    setSelectedTagId('');
    setSelectedRosterGuest(null);
  };

  if (!isAuthenticated) {
    return (
      <StationLockScreen
        stationTitle="door check-in"
        stationSubtitle="enter 4-digit staff pin to unlock door reception desk"
        stationBadge="DOOR RECEPTION DESK"
      />
    );
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const lastAdmittedSlotNum = lastAdmittedGuest
    ? parseTagId(lastAdmittedGuest.tag_id).tagNumber ?? lastAdmittedGuest.tag_id
    : null;

  return (
    <div className="w-full py-2 sm:py-3 lg:py-4 space-y-4 animate-in fade-in duration-150">
      {/* Top Station Header & Live Metrics Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-black/8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl sm:text-4xl font-bold lowercase text-black leading-none tracking-tight">
              door check-in
            </h1>
            <span className="font-mono text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-black/5 text-black/60 border border-black/10">
              reception desk
            </span>
          </div>
          <p className="font-sans-clean text-xs text-black/50 mt-1">
            wristband assignment, guest registration & access passes
          </p>
        </div>

        {/* Real-time stats pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/[0.03] border border-black/8">
            <span className="text-[11px] font-sans-clean text-black/50">admitted:</span>
            <span className="font-mono text-xs font-bold text-black">{admittedCount}</span>
          </div>

          {importedGuests.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900">
              <span className="text-[11px] font-sans-clean text-amber-900/70">awaiting:</span>
              <span className="font-mono text-xs font-bold text-amber-950">
                {pendingExpectedGuests.length}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/[0.03] border border-black/8">
            <span className="text-[11px] font-sans-clean text-black/50">next slot:</span>
            <span className="font-mono text-xs font-bold text-black">
              {parseTagId(nextFreeTag).tagNumber !== null
                ? `#${parseTagId(nextFreeTag).tagNumber}`
                : nextFreeTag}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsBatchEncoderOpen(true)}
            className="p-1.5 px-2.5 rounded-xl text-xs font-sans-clean text-black/60 hover:text-black bg-black/[0.03] hover:bg-black/[0.07] border border-black/8 transition-colors flex items-center gap-1.5 cursor-pointer ml-auto sm:ml-0"
            title="Batch NFC Wristband Encoder"
          >
            <Smartphone className="w-3.5 h-3.5 text-black/50" />
            <span className="hidden md:inline">batch encoder</span>
          </button>
        </div>
      </div>

      {/* Relayed Notice only if already registered */}
      {relayedTagNotice && (
        <div className="p-3 rounded-2xl bg-black text-white text-xs font-sans-clean font-medium flex items-center justify-between shadow-lg animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{relayedTagNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setRelayedTagNotice(null)}
            className="p-1 text-white/60 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sleek Check-In Confirmation Toast */}
      {lastAdmittedGuest && (
        <div className="p-3 rounded-2xl bg-black text-white shadow-xl flex items-center justify-between gap-3 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-sans-clean text-xs font-bold truncate">
              {lastAdmittedGuest.name} registered
            </span>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-white/15 uppercase font-bold shrink-0">
              {lastAdmittedGuest.category === 'vip'
                ? 'VIP'
                : lastAdmittedGuest.category === 'driver_minor'
                ? 'Driver'
                : 'Standard'}
            </span>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-white/10 shrink-0 hidden sm:inline">
              {lastAdmittedSlotNum !== null ? `#${lastAdmittedSlotNum}` : lastAdmittedGuest.tag_id}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() =>
                handleCopyText(
                  `${origin}/t/${lastAdmittedSlotNum}`,
                  `last-${lastAdmittedGuest.tag_id}`
                )
              }
              className="py-1 px-2.5 rounded-lg bg-white/20 hover:bg-white/30 text-white font-sans-clean font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
              title="Copy guest pass link"
            >
              {copiedKey === `last-${lastAdmittedGuest.tag_id}` ? (
                <Check className="w-3.5 h-3.5 text-emerald-300" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Pass Link</span>
            </button>
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/t/${encodeURIComponent(lastAdmittedGuest.tag_id)}?onboarded=1`
                )
              }
              className="py-1 px-2.5 rounded-lg bg-white text-black hover:bg-white/90 font-sans-clean font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Open</span>
            </button>
            <button
              type="button"
              onClick={() => setLastAdmittedGuest(null)}
              className="p-1 rounded-lg text-white/70 hover:text-white cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Responsive Layout: Left Desk Console + Right Guest Directory */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
        {/* Left Column (5 cols): Registration Console + Wristband Capacity Breakdown */}
        <div className="lg:col-span-5 space-y-4">
          <GuestOnboardingCard
            targetTagId={effectiveTargetTag}
            isUniversalLink={false}
            guests={guests}
            settings={settings}
            onTargetTagChange={newTag => setSelectedTagId(newTag)}
            onCheckIn={checkIn}
            onComplete={handleOnboardingComplete}
            selectedRosterGuest={selectedRosterGuest}
          />

          {/* Wristband Allocation & Inventory Card (Eliminates blank space on PC) */}
          <div className="glass-card p-4 sm:p-5 border border-black/12 shadow-md space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold lowercase text-black leading-none">
                wristband allocation
              </h3>
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-black/[0.04] border border-black/8 text-black/70">
                {admittedCount} / {totalCapacity} assigned
              </span>
            </div>

            {/* Capacity Progress Bar */}
            <div className="space-y-1.5">
              <div className="w-full h-2 bg-black/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-black rounded-full transition-all duration-300"
                  style={{ width: `${capacityPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-black/45">
                <span>{capacityPercent}% capacity checked in</span>
                <span>{availableSlots} available in box</span>
              </div>
            </div>

            {/* Breakdown Stats */}
            <div className="grid grid-cols-3 gap-2 pt-0.5">
              <div className="p-2.5 rounded-xl bg-black/[0.025] border border-black/8 text-center">
                <div className="text-[10px] font-sans-clean uppercase font-bold text-black/45 tracking-wider">
                  Standard
                </div>
                <div className="font-mono text-lg font-bold text-black mt-0.5">
                  {standardCount}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/60 text-center">
                <div className="text-[10px] font-sans-clean uppercase font-bold text-amber-800/80 tracking-wider">
                  VIP
                </div>
                <div className="font-mono text-lg font-bold text-amber-900 mt-0.5">
                  {vipCount}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200/60 text-center">
                <div className="text-[10px] font-sans-clean uppercase font-bold text-blue-800/80 tracking-wider">
                  Driver
                </div>
                <div className="font-mono text-lg font-bold text-blue-900 mt-0.5">
                  {driverCount}
                </div>
              </div>
            </div>

            {/* Terminal Hardware / Tap Status */}
            <div className="pt-1 flex items-center justify-between text-[11px] font-sans-clean text-black/50 border-t border-black/6">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>NFC scanner active</span>
              </span>
              <button
                type="button"
                onClick={() => setIsBatchEncoderOpen(true)}
                className="text-black/60 hover:text-black transition-colors inline-flex items-center gap-1 cursor-pointer font-medium"
              >
                <Smartphone className="w-3 h-3" />
                <span>batch encoder</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): Guest Directory (Expected & Admitted) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-card p-4 sm:p-5 border border-black/12 shadow-md space-y-3.5">
            {/* Header: Segmented Tabs when imported roster exists */}
            {importedGuests.length > 0 ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-1 border-b border-black/8">
                <div className="segmented-control p-1 bg-black/[0.04] rounded-xl flex gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('expected')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-sans-clean font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'expected'
                        ? 'bg-white text-black shadow-xs'
                        : 'text-black/55 hover:text-black'
                    }`}
                  >
                    <span>Expected Roster</span>
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                        activeTab === 'expected'
                          ? 'bg-amber-100 text-amber-900 font-bold'
                          : 'bg-black/5 text-black/50'
                      }`}
                    >
                      {pendingExpectedGuests.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('admitted')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-sans-clean font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'admitted'
                        ? 'bg-white text-black shadow-xs'
                        : 'text-black/55 hover:text-black'
                    }`}
                  >
                    <span>Admitted</span>
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                        activeTab === 'admitted'
                          ? 'bg-black text-white font-bold'
                          : 'bg-black/5 text-black/50'
                      }`}
                    >
                      {admittedGuests.length}
                    </span>
                  </button>
                </div>

                <span className="text-[11px] font-sans-clean text-black/45 hidden sm:inline">
                  {activeTab === 'expected'
                    ? 'click any guest to autofill registration'
                    : 'guest passes & profile editing'}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between pb-1 border-b border-black/8">
                <div>
                  <h3 className="font-display text-xl font-bold lowercase text-black leading-none">
                    admitted guests
                  </h3>
                  <p className="font-sans-clean text-xs text-black/45 mt-0.5">
                    attendees checked in at the door
                  </p>
                </div>
                <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full bg-black/6 text-black/75">
                  {admittedGuests.length} admitted
                </span>
              </div>
            )}

            {/* Unified Search & Category Filters */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-black/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder={
                    activeTab === 'expected'
                      ? 'Search expected guests by name or notes...'
                      : 'Search admitted guests by name, wristband #, or notes...'
                  }
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-2 bg-black/[0.035] border border-black/12 rounded-xl font-sans-clean text-xs text-black placeholder:text-black/35 outline-none focus:bg-white focus:border-black transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-black/40 hover:text-black cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                {(['all', 'vip', 'driver', 'standard'] as const).map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-sans-clean font-semibold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                      categoryFilter === cat
                        ? 'bg-black text-white shadow-xs'
                        : 'bg-black/[0.03] text-black/55 hover:bg-black/[0.06] hover:text-black'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Guest Directory List */}
            <div className="space-y-1.5 min-h-[320px] max-h-[500px] sm:max-h-[560px] lg:max-h-[620px] overflow-y-auto pr-1">
              {activeTab === 'expected' && importedGuests.length > 0 ? (
                /* Expected Guests List */
                filteredPendingExpectedGuests.length === 0 ? (
                  <div className="text-center py-16 text-xs font-sans-clean text-black/45 lowercase">
                    {pendingExpectedGuests.length === 0
                      ? '🎉 all expected guests have arrived!'
                      : 'no expected guests match the filter'}
                  </div>
                ) : (
                  filteredPendingExpectedGuests.map(guest => {
                    const isSelected = selectedRosterGuest?.id === guest.id;
                    return (
                      <div
                        key={guest.id}
                        onClick={() => {
                          soundSystem.vibrate(10);
                          setSelectedRosterGuest(guest);
                        }}
                        className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                          isSelected
                            ? 'bg-black text-white border-black shadow-xs'
                            : 'bg-white hover:bg-black/[0.02] border-black/8 text-black'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-sans-clean text-xs font-bold truncate">
                              {guest.name}
                            </span>
                            <span
                              className={`font-mono text-[9px] font-bold px-1.5 py-0.2 rounded uppercase shrink-0 ${
                                guest.category === 'vip'
                                  ? 'bg-amber-100 text-amber-900'
                                  : guest.category === 'driver_minor'
                                  ? 'bg-blue-100 text-blue-900'
                                  : 'bg-black/6 text-black/60'
                              }`}
                            >
                              {guest.category === 'vip'
                                ? 'VIP'
                                : guest.category === 'driver_minor'
                                ? 'Driver'
                                : 'Standard'}
                            </span>
                          </div>
                          {guest.notes && (
                            <p
                              className={`text-[10px] font-sans-clean truncate mt-0.5 ${
                                isSelected ? 'text-white/70' : 'text-black/50'
                              }`}
                            >
                              {guest.notes}
                            </p>
                          )}
                        </div>

                        <div className="shrink-0">
                          <span
                            className={`py-1 px-2.5 rounded-lg text-xs font-sans-clean font-semibold flex items-center gap-1 transition-all ${
                              isSelected
                                ? 'bg-white text-black font-bold'
                                : 'bg-black/5 text-black/75'
                            }`}
                          >
                            {isSelected ? 'ready' : 'select'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )
              ) : (
                /* Admitted Guests List */
                filteredAdmittedGuests.length === 0 ? (
                  <div className="text-center py-16 text-xs font-sans-clean text-black/45 lowercase space-y-1">
                    <div>
                      {admittedGuests.length === 0
                        ? 'no guests admitted yet — register attendees on the left!'
                        : 'no admitted guests match the filter'}
                    </div>
                  </div>
                ) : (
                  filteredAdmittedGuests.map(guest => {
                    const cleanNote = stripUidFromNotes(guest.notes);
                    const isEditingThis = effectiveTargetTag === guest.tag_id;
                    const parsedSlot = parseTagId(guest.tag_id);
                    const slotNum = parsedSlot.tagNumber ?? guest.tag_id;

                    return (
                      <div
                        key={guest.id}
                        className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                          isEditingThis
                            ? 'bg-black text-white border-black shadow-xs'
                            : 'bg-white hover:bg-black/[0.02] border-black/8 text-black'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-sans-clean text-xs font-bold truncate">
                              {guest.name}
                            </span>
                            <span
                              className={`font-mono text-[9px] font-bold px-1.5 py-0.2 rounded uppercase shrink-0 ${
                                guest.category === 'vip'
                                  ? 'bg-amber-100 text-amber-900'
                                  : guest.category === 'driver_minor'
                                  ? 'bg-blue-100 text-blue-900'
                                  : 'bg-black/6 text-black/60'
                              }`}
                            >
                              {guest.category === 'vip'
                                ? 'VIP'
                                : guest.category === 'driver_minor'
                                ? 'Driver'
                                : 'Standard'}
                            </span>
                            <span className="font-mono text-[10px] text-black/45">
                              #{slotNum}
                            </span>
                            {guest.entered_at && (
                              <span className="text-[10px] font-mono text-black/35 hidden sm:inline">
                                • {formatEntryTime(guest.entered_at)}
                              </span>
                            )}
                          </div>
                          {cleanNote && (
                            <p
                              className={`text-[10px] font-sans-clean truncate mt-0.5 ${
                                isEditingThis ? 'text-white/70' : 'text-black/50'
                              }`}
                            >
                              {cleanNote}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyText(`${origin}/t/${slotNum}`, `pass-${guest.tag_id}`)
                            }
                            className={`p-1.5 rounded-lg text-xs font-sans-clean transition-colors cursor-pointer ${
                              isEditingThis
                                ? 'text-white hover:bg-white/20'
                                : 'text-black/50 hover:text-black hover:bg-black/5'
                            }`}
                            title="Copy guest pass link"
                          >
                            {copiedKey === `pass-${guest.tag_id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              router.push(`/t/${encodeURIComponent(guest.tag_id)}?onboarded=1`)
                            }
                            className={`p-1.5 rounded-lg text-xs font-sans-clean transition-colors cursor-pointer ${
                              isEditingThis
                                ? 'text-white hover:bg-white/20'
                                : 'text-black/50 hover:text-black hover:bg-black/5'
                            }`}
                            title="Open guest pass"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedTagId(guest.tag_id)}
                            className={`p-1.5 rounded-lg text-xs font-sans-clean transition-colors cursor-pointer ${
                              isEditingThis
                                ? 'text-white hover:bg-white/20'
                                : 'text-black/50 hover:text-black hover:bg-black/5'
                            }`}
                            title="Edit guest profile"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Batch Encoder Modal (Optional backup tool) */}
      <NfcWriterModal
        isOpen={isBatchEncoderOpen}
        onClose={() => setIsBatchEncoderOpen(false)}
        initialTagNumber={1}
      />
    </div>
  );
}
