'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePartyStore } from '@/lib/store';
import { Guest, GuestCategory } from '@/lib/types';
import {
  UserCheck,
  CheckCircle2,
  LogOut,
  ShieldCheck,
  Wifi,
  Copy,
  Check,
  ExternalLink,
  Search,
  Sparkles,
  Tag,
  Link2,
  Edit3,
  Smartphone,
  AlertTriangle,
  LayoutGrid,
  List,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  parseTagId,
  getNextFreeTagId,
  isUniversalOnboardingTag,
  stripUidFromNotes,
} from '@/lib/tag-utils';
import { soundSystem } from '@/lib/audio';
import { useStaffAuth, setStaffStationMode } from '@/lib/auth';
import { subscribeToTagRelay, sendTagRelayMessage } from '@/lib/tag-relay';
import { StationLockScreen } from '@/components/StationLockScreen';
import { GuestOnboardingCard } from '@/components/GuestOnboardingCard';
import { NfcWriterModal } from '@/components/NfcWriterModal';
import { calculateEffectiveLimit } from '@/lib/party-engine';

type DoorCategoryFilter = 'all' | GuestCategory;

export default function DoorCheckInPage() {
  const router = useRouter();
  const { guests, checkIn, settings } = usePartyStore();
  const { isAuthenticated, logout } = useStaffAuth();
  const [isBatchEncoderOpen, setIsBatchEncoderOpen] = useState(false);

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
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<DoorCategoryFilter>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Clipboard copy feedback states
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const effectiveTargetTag = useMemo(() => {
    if (!selectedTagId || isUniversalOnboardingTag(selectedTagId)) {
      return nextFreeTag;
    }
    return selectedTagId;
  }, [selectedTagId, nextFreeTag]);

  const effectiveSlotNumber = useMemo(() => {
    return parseTagId(effectiveTargetTag).tagNumber ?? 1;
  }, [effectiveTargetTag]);

  // Mark staff phone in 'door' station mode
  useEffect(() => {
    if (isAuthenticated) {
      setStaffStationMode('door');
    }
  }, [isAuthenticated]);

  // Listen for NFC taps relayed from /t/[id] tabs
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribe = subscribeToTagRelay(msg => {
      if (msg.type === 'PING_STATION') {
        sendTagRelayMessage({
          type: 'STATION_ACK',
          station: 'door',
        });
      } else if (msg.type === 'TAG_TAPPED' && msg.tagId) {
        if (!isUniversalOnboardingTag(msg.tagId)) {
          setSelectedTagId(msg.tagId);
        }
        soundSystem.playApprovedSound();
        setRelayedTagNotice(`Wristband tapped: ${msg.tagId}`);
        setTimeout(() => setRelayedTagNotice(null), 4000);
      }
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

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

  const filteredAdmittedGuests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = admittedGuests;

    if (categoryFilter !== 'all') {
      list = list.filter(g => g.category === categoryFilter);
    }

    if (!q) return list;
    return list.filter(
      g =>
        (g.name || '').toLowerCase().includes(q) ||
        g.tag_id.toLowerCase().includes(q) ||
        (g.notes || '').toLowerCase().includes(q)
    );
  }, [admittedGuests, searchQuery, categoryFilter]);

  const driverCount = useMemo(
    () => admittedGuests.filter(g => g.category === 'driver_minor').length,
    [admittedGuests]
  );
  const vipCount = useMemo(
    () => admittedGuests.filter(g => g.category === 'vip').length,
    [admittedGuests]
  );
  const standardCount = useMemo(
    () => admittedGuests.filter(g => g.category === 'standard').length,
    [admittedGuests]
  );
  const freeSlotsCount = useMemo(
    () => guests.filter(g => !g.is_entered && !g.name).length,
    [guests]
  );

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    soundSystem.playApprovedSound();
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const handleOnboardingComplete = (admittedGuest: Guest) => {
    confetti({
      particleCount: 55,
      spread: 65,
      origin: { y: 0.7 },
    });

    setLastAdmittedGuest(admittedGuest);
    setSelectedTagId('');
  };

  // If not authenticated, show professional StationLockScreen with immediate keyboard typing
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
  const currentShortUrl = `${origin}/t/${effectiveSlotNumber}`;
  const lastAdmittedSlotNum = lastAdmittedGuest
    ? parseTagId(lastAdmittedGuest.tag_id).tagNumber ?? lastAdmittedGuest.tag_id
    : null;

  return (
    <div className="w-full py-4 lg:py-6 space-y-5 lg:space-y-6 animate-in fade-in duration-150">
      {/* 1. Host Status Header */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-black text-white text-xs font-sans-clean flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <span className="font-bold text-[10px] tracking-wider uppercase block leading-tight">
              Door Onboarding Station
            </span>
            <span className="text-[10px] text-emerald-400/90 flex items-center gap-1 font-mono leading-tight">
              <Wifi className="w-2.5 h-2.5" />
              iPhone &amp; Live Wristband Relay Active
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsBatchEncoderOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Smartphone className="w-3 h-3" />
            <span>NFC Sticker Copier (/t/1..100)</span>
          </button>

          <button
            type="button"
            onClick={logout}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Lock</span>
          </button>
        </div>
      </div>

      {/* Live Relay Notice */}
      {relayedTagNotice && (
        <div className="p-3 rounded-2xl bg-emerald-600 text-white text-xs font-sans-clean font-bold text-center shadow-lg animate-in fade-in duration-150">
          ⚡ {relayedTagNotice}
        </div>
      )}

      {/* 2. Live Door Telemetry KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <div className="glass-card p-4 sm:p-5 lg:p-6 border border-black/10">
          <div className="flex items-center justify-between mb-1">
            <span className="font-sans-clean text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-black/45">
              admitted inside
            </span>
            <UserCheck className="w-4 h-4 text-black/40" />
          </div>
          <div className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-black leading-none">
            {admittedGuests.length}
            <span className="text-base sm:text-xl text-black/35 font-normal">/{guests.length}</span>
          </div>
          <span className="text-[11px] font-sans-clean text-black/50 lowercase block mt-1.5 truncate">
            {freeSlotsCount} wristbands free
          </span>
        </div>

        <button
          type="button"
          onClick={() => setSelectedTagId(nextFreeTag)}
          className="glass-card p-4 sm:p-5 lg:p-6 border border-black/10 hover:border-black/30 text-left transition-all cursor-pointer"
          title="Click to reset target slot to next free wristband"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-sans-clean text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-black/45">
              next free slot
            </span>
            <Tag className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="font-mono text-xl sm:text-2xl lg:text-3xl font-bold text-black leading-none mt-1">
            #{parseTagId(nextFreeTag).tagNumber ?? nextFreeTag}
          </div>
          <span className="text-[11px] font-sans-clean text-black/50 lowercase block mt-1.5 truncate">
            {nextFreeTag} auto-assigned
          </span>
        </button>

        <div className="glass-card p-4 sm:p-5 lg:p-6 border border-black/10">
          <div className="flex items-center justify-between mb-1">
            <span className="font-sans-clean text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-black/45">
              vip hosts
            </span>
            <Sparkles className="w-4 h-4 text-amber-600" />
          </div>
          <div className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-black leading-none">
            {vipCount}
          </div>
          <span className="text-[11px] font-sans-clean text-black/50 lowercase block mt-1.5 truncate">
            unlimited drink privilege
          </span>
        </div>

        <div className="glass-card p-4 sm:p-5 lg:p-6 border border-black/10">
          <div className="flex items-center justify-between mb-1">
            <span className="font-sans-clean text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-black/45">
              designated drivers
            </span>
            <span className="font-mono text-xs font-bold text-blue-700">0 ALC</span>
          </div>
          <div className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-black leading-none">
            {driverCount}
          </div>
          <span className="text-[11px] font-sans-clean text-black/50 lowercase block mt-1.5 truncate">
            soft drinks only
          </span>
        </div>
      </section>

      {/* 3. Main 2-Column Onboarding & Registry Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column (7 cols, sticky on desktop): Unified Onboarding Console */}
        <div className="lg:col-span-7 xl:col-span-7 space-y-4 lg:sticky lg:top-24">
          {/* Celebratory Last Admitted Banner */}
          {lastAdmittedGuest && (
            <div className="p-5 rounded-3xl bg-emerald-600 text-white shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full">
                    ONBOARDED • #{lastAdmittedSlotNum} ({lastAdmittedGuest.tag_id})
                  </span>
                </div>
                <span className="font-mono text-[11px] text-white/80">
                  next up: {nextFreeTag}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-2xl font-bold lowercase leading-tight">
                    {lastAdmittedGuest.name}
                  </h3>
                  <p className="font-sans-clean text-xs text-white/90">
                    Sticker URL: <strong className="font-mono">/t/{lastAdmittedSlotNum}</strong> •{' '}
                    {lastAdmittedGuest.category === 'vip'
                      ? 'VIP Host'
                      : lastAdmittedGuest.category === 'driver_minor'
                      ? '0 Alc Driver'
                      : `${calculateEffectiveLimit(lastAdmittedGuest, settings)} drinks limit`}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText(
                        `${origin}/t/${lastAdmittedSlotNum}`,
                        `last-${lastAdmittedGuest.tag_id}`
                      )
                    }
                    className="py-2 px-3 rounded-xl bg-white/20 hover:bg-white/30 text-white font-sans-clean font-bold text-xs flex items-center gap-1.5 border border-white/25 transition-all cursor-pointer"
                  >
                    {copiedKey === `last-${lastAdmittedGuest.tag_id}` ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/t/${encodeURIComponent(lastAdmittedGuest.tag_id)}?onboarded=1`
                      )
                    }
                    className="py-2 px-3 rounded-xl bg-white text-black hover:bg-white/90 font-sans-clean font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Pass</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Unified Guest Onboarding Card */}
          <GuestOnboardingCard
            targetTagId={effectiveTargetTag}
            isUniversalLink={false}
            guests={guests}
            settings={settings}
            onTargetTagChange={newTag => setSelectedTagId(newTag)}
            onCheckIn={checkIn}
            onComplete={handleOnboardingComplete}
          />
        </div>

        {/* Right Column (5 cols): iPhone Sticker Helper + Admitted Registry */}
        <div className="lg:col-span-5 xl:col-span-5 space-y-5">
          {/* Card 1: iPhone-Optimized Sticker Link Helper */}
          <div className="glass-card p-5 sm:p-6 border border-black/12 shadow-md space-y-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
                <Link2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-display text-xl font-bold lowercase text-black leading-none">
                  iphone nfc sticker links
                </h3>
                <p className="font-sans-clean text-[11px] text-black/50 lowercase mt-0.5">
                  short urls (<code className="font-mono">/t/1</code> .. <code className="font-mono">/t/100</code>) for nfc tools
                </p>
              </div>
            </div>

            {/* Current Target Slot Shortcut */}
            <div className="p-3 rounded-2xl bg-black/[0.03] border border-black/8 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-black/60">
                <span>STICKER #{effectiveSlotNumber}</span>
                <span className="text-emerald-700 font-sans-clean">1st tap onboard • 2nd pass</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-xl bg-white border border-black/10 font-mono text-xs font-bold text-black truncate select-all">
                  {currentShortUrl}
                </code>
                <button
                  type="button"
                  onClick={() => handleCopyText(currentShortUrl, 'slot')}
                  className="btn-premium-primary py-2 px-3 text-xs gap-1.5 shrink-0 cursor-pointer"
                >
                  {copiedKey === 'slot' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsBatchEncoderOpen(true)}
              className="btn-premium w-full py-2.5 text-xs gap-2 cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>sequential nfc copier (/t/1 → /t/100)</span>
            </button>
          </div>

          {/* Card 2: Admitted Guests Feed with Filters & View Switcher */}
          <div className="glass-card p-5 sm:p-6 border border-black/12 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-2xl font-bold lowercase text-black leading-none">
                  admitted guests
                </h3>
                <p className="font-sans-clean text-[11px] text-black/50 lowercase mt-0.5">
                  click guest to edit profile or load pass
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-black/6 text-black/75">
                  {filteredAdmittedGuests.length}
                </span>

                {/* View Mode Switcher */}
                <div className="hidden sm:inline-flex items-center p-0.5 rounded-lg bg-black/[0.04] border border-black/8">
                  <button
                    type="button"
                    onClick={() => setViewMode('cards')}
                    className={`p-1 rounded-md transition-colors ${
                      viewMode === 'cards'
                        ? 'bg-white text-black shadow-xs'
                        : 'text-black/45 hover:text-black'
                    }`}
                    title="Cards View"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={`p-1 rounded-md transition-colors ${
                      viewMode === 'table'
                        ? 'bg-white text-black shadow-xs'
                        : 'text-black/45 hover:text-black'
                    }`}
                    title="Compact Table View"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: 'all', count: admittedGuests.length },
                  { id: 'vip', label: 'vip', count: vipCount },
                  { id: 'driver_minor', label: 'driver', count: driverCount },
                  { id: 'standard', label: 'standard', count: standardCount },
                ] as const
              ).map(tab => {
                const isActive = categoryFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCategoryFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-sans-clean font-semibold lowercase transition-all cursor-pointer ${
                      isActive
                        ? 'bg-black text-white shadow-xs'
                        : 'bg-black/[0.03] hover:bg-black/[0.06] text-black/65'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="ml-1 font-mono text-[10px] opacity-75">
                      ({tab.count})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Filter */}
            {admittedGuests.length > 0 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-black/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter admitted guests by name or #..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-black/[0.035] border border-black/12 rounded-xl font-sans-clean text-xs text-black placeholder:text-black/35 outline-none focus:bg-white focus:border-black transition-colors"
                />
              </div>
            )}

            {/* Admitted List (Cards or Table) */}
            <div className="space-y-2 max-h-96 lg:max-h-[500px] overflow-y-auto pr-1 no-scrollbar">
              {filteredAdmittedGuests.length === 0 ? (
                <div className="text-center py-10 text-xs font-sans-clean text-black/45 lowercase">
                  {admittedGuests.length === 0
                    ? 'no guests admitted yet — onboard your first guest on the left!'
                    : 'no admitted guests match the selected filter'}
                </div>
              ) : viewMode === 'table' ? (
                /* Compact Table View on Desktop */
                <div className="divide-y divide-black/[0.06] border border-black/10 rounded-xl overflow-hidden bg-white">
                  {filteredAdmittedGuests.map(guest => {
                    const effLimit = calculateEffectiveLimit(guest, settings);
                    const slotNum = parseTagId(guest.tag_id).tagNumber ?? guest.tag_id;
                    const isEditingThis = effectiveTargetTag === guest.tag_id;

                    return (
                      <div
                        key={guest.id}
                        className={`p-2.5 flex items-center justify-between gap-2 text-xs transition-colors ${
                          isEditingThis ? 'bg-black/5 font-bold' : 'hover:bg-black/[0.02]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-black/5">
                            #{slotNum}
                          </span>
                          <span className="font-sans-clean font-bold text-black truncate">
                            {guest.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-[11px] text-black/60">
                            {guest.drinks_consumed}/{guest.category === 'vip' ? '∞' : effLimit}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedTagId(guest.tag_id)}
                            className="p-1 rounded hover:bg-black/10 text-black/50 hover:text-black"
                            title="Edit guest"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Cards View */
                filteredAdmittedGuests.map(guest => {
                  const effLimit = calculateEffectiveLimit(guest, settings);
                  const cleanNote = stripUidFromNotes(guest.notes);
                  const isEditingThis = effectiveTargetTag === guest.tag_id;
                  const slotNum = parseTagId(guest.tag_id).tagNumber ?? guest.tag_id;

                  return (
                    <div
                      key={guest.id}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-2 ${
                        isEditingThis
                          ? 'bg-black text-white border-black shadow-sm'
                          : 'bg-white hover:bg-black/[0.02] border-black/8 text-black'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                              isEditingThis
                                ? 'bg-white/20 text-white'
                                : 'bg-black/6 text-black/75'
                            }`}
                          >
                            #{slotNum}
                          </span>
                          <span className="font-sans-clean text-xs font-bold truncate">
                            {guest.name}
                          </span>
                        </div>

                        <div
                          className={`flex flex-wrap items-center gap-2 mt-1 text-[10px] font-sans-clean ${
                            isEditingThis ? 'text-white/70' : 'text-black/50'
                          }`}
                        >
                          <span>
                            {guest.category === 'vip'
                              ? '✨ VIP (∞)'
                              : guest.category === 'driver_minor'
                              ? '🚗 Driver (0 alc)'
                              : `🍺 ${guest.drinks_consumed}/${effLimit} drinks`}
                          </span>
                          {guest.entered_at && (
                            <span>
                              •{' '}
                              {new Date(guest.entered_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false,
                              })}
                            </span>
                          )}
                          {cleanNote && <span className="truncate">• {cleanNote}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText(`${origin}/t/${slotNum}`, guest.id)
                          }
                          title={`Copy /t/${slotNum} sticker link`}
                          className={`p-2 rounded-xl transition-colors cursor-pointer ${
                            isEditingThis
                              ? 'hover:bg-white/15 text-white/80'
                              : 'hover:bg-black/5 text-black/55 hover:text-black'
                          }`}
                        >
                          {copiedKey === guest.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedTagId(guest.tag_id)}
                          title="Load guest into onboarding form to edit"
                          className={`p-2 rounded-xl transition-colors cursor-pointer ${
                            isEditingThis
                              ? 'bg-white/20 text-white'
                              : 'hover:bg-black/5 text-black/55 hover:text-black'
                          }`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/t/${encodeURIComponent(String(slotNum))}?mode=view`)
                          }
                          title={`Open guest pass (/t/${slotNum})`}
                          className={`p-2 rounded-xl transition-colors cursor-pointer ${
                            isEditingThis
                              ? 'hover:bg-white/15 text-white/80'
                              : 'hover:bg-black/5 text-black/55 hover:text-black'
                          }`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* iPhone Sequential NFC Sticker Encoder Modal */}
      <NfcWriterModal
        isOpen={isBatchEncoderOpen}
        onClose={() => setIsBatchEncoderOpen(false)}
        initialTagNumber={effectiveSlotNumber}
      />
    </div>
  );
}
